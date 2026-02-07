
-- 1. Add active_tenant_id to profiles
ALTER TABLE public.profiles
ADD COLUMN active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- 2. Create SECURITY DEFINER function: create_invite
CREATE OR REPLACE FUNCTION public.create_invite(
  _tenant_id uuid,
  _email text,
  _role app_role DEFAULT 'agent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _invite_id uuid;
  _token text;
  _expires_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_AUTHENTICATED', 'message', 'Usuário não autenticado'));
  END IF;

  -- Only admins can create invites
  IF NOT public.is_tenant_admin(_user_id, _tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'FORBIDDEN', 'message', 'Apenas administradores podem criar convites'));
  END IF;

  -- Validate email format
  IF _email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_EMAIL', 'message', 'Email inválido'));
  END IF;

  -- Check for existing pending invite
  IF EXISTS (
    SELECT 1 FROM public.invites
    WHERE tenant_id = _tenant_id AND email = _email AND accepted_at IS NULL AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVITE_EXISTS', 'message', 'Já existe um convite pendente para este email'));
  END IF;

  _token := encode(extensions.gen_random_bytes(32), 'hex');
  _expires_at := now() + interval '7 days';

  INSERT INTO public.invites (tenant_id, email, role, token, expires_at)
  VALUES (_tenant_id, _email, _role, _token, _expires_at)
  RETURNING id INTO _invite_id;

  -- Audit log
  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, entity, entity_id, metadata)
  VALUES (_tenant_id, _user_id, 'invite.created', 'invite', _invite_id::text, jsonb_build_object('email', _email, 'role', _role::text));

  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('id', _invite_id, 'token', _token, 'expires_at', _expires_at));
END;
$$;

-- 3. Create SECURITY DEFINER function: log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _tenant_id uuid,
  _action text,
  _entity text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_tenant_member(_user_id, _tenant_id) THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, entity, entity_id, metadata)
  VALUES (_tenant_id, _user_id, _action, _entity, _entity_id, _metadata);
END;
$$;

-- 4. Drop direct INSERT policy on invites (writes go through RPC now)
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;

-- 5. Drop direct INSERT policy on audit_logs (writes go through RPC now)
DROP POLICY IF EXISTS "Members can insert audit logs" ON public.audit_logs;
