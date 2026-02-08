
-- ============================================================
-- ETAPA 2: CRM Tables, RLS Policies, Indexes, Default Pipeline
-- ============================================================

-- 1. PIPELINES
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant pipelines" ON public.pipelines
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert pipelines" ON public.pipelines
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update pipelines" ON public.pipelines
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete pipelines" ON public.pipelines
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. PIPELINE_STAGES
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, position)
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant stages" ON public.pipeline_stages
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert stages" ON public.pipeline_stages
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update stages" ON public.pipeline_stages
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete stages" ON public.pipeline_stages
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. COMPANIES
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant companies" ON public.companies
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert companies" ON public.companies
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can insert companies" ON public.companies
  FOR INSERT WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'agent'));

CREATE POLICY "Admin/manager can update companies" ON public.companies
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can update companies" ON public.companies
  FOR UPDATE USING (public.has_tenant_role(auth.uid(), tenant_id, 'agent'));

CREATE POLICY "Admin/manager can delete companies" ON public.companies
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  email text,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant leads" ON public.leads
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert leads" ON public.leads
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can insert leads" ON public.leads
  FOR INSERT WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'agent'));

CREATE POLICY "Admin/manager can update leads" ON public.leads
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can update leads" ON public.leads
  FOR UPDATE USING (public.has_tenant_role(auth.uid(), tenant_id, 'agent'));

CREATE POLICY "Admin/manager can delete leads" ON public.leads
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. DEALS
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id),
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id),
  lead_id uuid REFERENCES public.leads(id),
  company_id uuid REFERENCES public.companies(id),
  title text NOT NULL,
  value_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  owner_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX idx_deals_pipeline ON public.deals(pipeline_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_owner ON public.deals(owner_user_id);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant deals" ON public.deals
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert deals" ON public.deals
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can insert own deals" ON public.deals
  FOR INSERT WITH CHECK (
    public.has_tenant_role(auth.uid(), tenant_id, 'agent')
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "Admin/manager can update deals" ON public.deals
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can update own deals" ON public.deals
  FOR UPDATE USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'agent')
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "Admin/manager can delete deals" ON public.deals
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  deal_id uuid REFERENCES public.deals(id),
  lead_id uuid REFERENCES public.leads(id),
  company_id uuid REFERENCES public.companies(id),
  title text NOT NULL,
  description text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  assigned_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant tasks" ON public.tasks
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    public.has_tenant_role(auth.uid(), tenant_id, 'agent')
    AND assigned_user_id = auth.uid()
  );

CREATE POLICY "Admin/manager can update tasks" ON public.tasks
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can update own tasks" ON public.tasks
  FOR UPDATE USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'agent')
    AND assigned_user_id = auth.uid()
  );

CREATE POLICY "Admin/manager can delete tasks" ON public.tasks
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. ACTIVITY_TIMELINE
CREATE TABLE public.activity_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_user_id uuid REFERENCES public.profiles(id),
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_timeline_tenant_created ON public.activity_timeline(tenant_id, created_at DESC);

ALTER TABLE public.activity_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant activity" ON public.activity_timeline
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Activity timeline INSERT is done via RPC only
-- No direct INSERT policy for clients

-- 8. TAGS
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant tags" ON public.tags
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert tags" ON public.tags
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update tags" ON public.tags
  FOR UPDATE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete tags" ON public.tags
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. ENTITY_TAGS
CREATE TABLE public.entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, tag_id, entity, entity_id)
);

ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant entity_tags" ON public.entity_tags
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert entity_tags" ON public.entity_tags
  FOR INSERT WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete entity_tags" ON public.entity_tags
  FOR DELETE USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- ============================================================
-- RPC: log_activity_event (SECURITY DEFINER for activity_timeline)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_activity_event(
  _tenant_id uuid,
  _entity text,
  _entity_id text,
  _action text,
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

  INSERT INTO public.activity_timeline (tenant_id, actor_user_id, entity, entity_id, action, metadata)
  VALUES (_tenant_id, _user_id, _entity, _entity_id, _action, _metadata);
END;
$$;

-- ============================================================
-- Update create_tenant_with_admin to create default pipeline
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin(_name text, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _tenant_id UUID;
  _pipeline_id UUID;
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

  -- Create default pipeline with 5 stages
  INSERT INTO public.pipelines (tenant_id, name, is_default) VALUES (_tenant_id, 'Pipeline Padrão', true) RETURNING id INTO _pipeline_id;
  INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, position, color) VALUES
    (_tenant_id, _pipeline_id, 'Novo', 0, '#6366f1'),
    (_tenant_id, _pipeline_id, 'Contato feito', 1, '#3b82f6'),
    (_tenant_id, _pipeline_id, 'Proposta', 2, '#f59e0b'),
    (_tenant_id, _pipeline_id, 'Negociação', 3, '#f97316'),
    (_tenant_id, _pipeline_id, 'Fechado', 4, '#22c55e');

  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, entity, entity_id, metadata)
  VALUES (_tenant_id, _user_id, 'tenant.created', 'tenant', _tenant_id::text, jsonb_build_object('name', _name, 'slug', _slug));
  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('tenant_id', _tenant_id));
END;
$$;
