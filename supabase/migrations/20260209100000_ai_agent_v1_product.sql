-- =============================================
-- AI Agent V1 product: max_consecutive_replies + agent_activity_logs
-- =============================================

-- 1. max_consecutive_replies em ai_agent_settings (default 5)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_agent_settings' AND column_name = 'max_consecutive_replies'
  ) THEN
    ALTER TABLE public.ai_agent_settings
    ADD COLUMN max_consecutive_replies integer NOT NULL DEFAULT 5;
  END IF;
END $$;

-- 2. agent_activity_logs (quando respondeu, canal, se foi interrompido)
CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  interrupted_by_handoff boolean NOT NULL DEFAULT false,
  content_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_tenant_responded
  ON public.agent_activity_logs (tenant_id, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_thread
  ON public.agent_activity_logs (thread_id);

ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant agent_activity_logs"
  ON public.agent_activity_logs FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can insert agent_activity_logs"
  ON public.agent_activity_logs FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can update agent_activity_logs"
  ON public.agent_activity_logs FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id));

COMMENT ON TABLE public.agent_activity_logs IS 'Log de respostas do agente de atendimento (para aba Atividade)';
