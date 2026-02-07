
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent');

-- Profiles table (synced with auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships table
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'agent',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_invites_updated_at BEFORE UPDATE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Security definer functions for RLS (avoid infinite recursion)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.memberships WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin_or_manager(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id AND role IN ('admin', 'manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role
  )
$$;

-- Business logic: create tenant + admin membership atomically
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin(_name TEXT, _slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _tenant_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_AUTHENTICATED', 'message', 'Usuário não autenticado'));
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = _slug) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SLUG_EXISTS', 'message', 'Este slug já está em uso'));
  END IF;
  INSERT INTO public.tenants (name, slug) VALUES (_name, _slug) RETURNING id INTO _tenant_id;
  INSERT INTO public.memberships (tenant_id, user_id, role) VALUES (_tenant_id, _user_id, 'admin');
  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, entity, entity_id, metadata)
  VALUES (_tenant_id, _user_id, 'tenant.created', 'tenant', _tenant_id::text, jsonb_build_object('name', _name, 'slug', _slug));
  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('tenant_id', _tenant_id));
END;
$$;

-- Business logic: accept invite by token
CREATE OR REPLACE FUNCTION public.accept_invite(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _user_id UUID;
  _membership_id UUID;
BEGIN
  SELECT * INTO _invite FROM public.invites WHERE token = _token AND accepted_at IS NULL;
  IF _invite IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVITE_NOT_FOUND', 'message', 'Convite não encontrado ou já aceito'));
  END IF;
  IF _invite.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVITE_EXPIRED', 'message', 'Convite expirado'));
  END IF;
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_AUTHENTICATED', 'message', 'Usuário não autenticado'));
  END IF;
  IF public.is_tenant_member(_user_id, _invite.tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ALREADY_MEMBER', 'message', 'Você já é membro deste workspace'));
  END IF;
  INSERT INTO public.memberships (tenant_id, user_id, role) VALUES (_invite.tenant_id, _user_id, _invite.role) RETURNING id INTO _membership_id;
  UPDATE public.invites SET accepted_at = now() WHERE id = _invite.id;
  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, entity, entity_id, metadata)
  VALUES (_invite.tenant_id, _user_id, 'invite.accepted', 'invite', _invite.id::text, jsonb_build_object('role', _invite.role::text, 'email', _invite.email));
  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('membership_id', _membership_id, 'tenant_id', _invite.tenant_id));
END;
$$;

-- RLS: Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view co-member profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR id IN (SELECT m.user_id FROM public.memberships m WHERE m.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- RLS: Tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own tenants" ON public.tenants FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admins can update tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), id));

-- RLS: Memberships
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant memberships" ON public.memberships FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert memberships" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update memberships" ON public.memberships FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete memberships" ON public.memberships FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- RLS: Invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tenant invites" ON public.invites FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can create invites" ON public.invites FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update invites" ON public.invites FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete invites" ON public.invites FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- RLS: Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Members can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Performance indexes
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_tenant_id ON public.invites(tenant_id);
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_profiles_email ON public.profiles(email);
