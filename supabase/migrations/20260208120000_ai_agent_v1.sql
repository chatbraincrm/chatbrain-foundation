-- =============================================
-- AI Agent V1: tables, RLS, messages.sender_subtype
-- =============================================

-- 1. AI_AGENTS
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  system_prompt text NOT NULL,
  user_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant ai_agents"
  ON public.ai_agents FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert ai_agents"
  ON public.ai_agents FOR INSERT
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update ai_agents"
  ON public.ai_agents FOR UPDATE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete ai_agents"
  ON public.ai_agents FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 2. AI_AGENT_CHANNELS
CREATE TABLE IF NOT EXISTS public.ai_agent_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('internal', 'whatsapp', 'email', 'instagram')),
  is_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(agent_id, channel_type)
);

ALTER TABLE public.ai_agent_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant ai_agent_channels"
  ON public.ai_agent_channels FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert ai_agent_channels"
  ON public.ai_agent_channels FOR INSERT
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update ai_agent_channels"
  ON public.ai_agent_channels FOR UPDATE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete ai_agent_channels"
  ON public.ai_agent_channels FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 3. AI_AGENT_SETTINGS
CREATE TABLE IF NOT EXISTS public.ai_agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE UNIQUE,
  response_delay_ms integer NOT NULL DEFAULT 1200,
  use_chunked_messages boolean NOT NULL DEFAULT true,
  allow_audio boolean NOT NULL DEFAULT true,
  allow_images boolean NOT NULL DEFAULT true,
  allow_handoff_human boolean NOT NULL DEFAULT true,
  allow_scheduling boolean NOT NULL DEFAULT true,
  typing_simulation boolean NOT NULL DEFAULT true,
  max_chunks integer NOT NULL DEFAULT 6,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_ai_agent_settings_updated_at
  BEFORE UPDATE ON public.ai_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant ai_agent_settings"
  ON public.ai_agent_settings FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert ai_agent_settings"
  ON public.ai_agent_settings FOR INSERT
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update ai_agent_settings"
  ON public.ai_agent_settings FOR UPDATE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete ai_agent_settings"
  ON public.ai_agent_settings FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 4. AI_AGENT_KNOWLEDGE
CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  source_type text NOT NULL CHECK (source_type IN ('text', 'link', 'file')),
  source_url text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant ai_agent_knowledge"
  ON public.ai_agent_knowledge FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert ai_agent_knowledge"
  ON public.ai_agent_knowledge FOR INSERT
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update ai_agent_knowledge"
  ON public.ai_agent_knowledge FOR UPDATE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete ai_agent_knowledge"
  ON public.ai_agent_knowledge FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 5. ALTER MESSAGES: sender_subtype + index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_subtype'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN sender_subtype text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_thread_created
  ON public.messages (tenant_id, thread_id, created_at);
