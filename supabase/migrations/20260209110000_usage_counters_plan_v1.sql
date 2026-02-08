-- =============================================
-- Plano Único V1: usage_counters + RPC de incremento
-- =============================================

CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period text NOT NULL,
  messages_count integer NOT NULL DEFAULT 0,
  ai_messages_count integer NOT NULL DEFAULT 0,
  threads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_tenant_period
  ON public.usage_counters (tenant_id, period);

COMMENT ON TABLE public.usage_counters IS 'Uso mensal por tenant (período YYYY-MM) para limites do plano';

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant usage_counters"
  ON public.usage_counters FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- INSERT/UPDATE apenas via RPC (sem policy para app user)
-- RPC SECURITY DEFINER para incrementar
CREATE OR REPLACE FUNCTION public.increment_usage_counters(
  _tenant_id uuid,
  _period text,
  _messages_delta integer DEFAULT 0,
  _ai_messages_delta integer DEFAULT 0,
  _threads_delta integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  IF _messages_delta = 0 AND _ai_messages_delta = 0 AND _threads_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.usage_counters (tenant_id, period, messages_count, ai_messages_count, threads_count, updated_at)
  VALUES (_tenant_id, _period, 0, 0, 0, now())
  ON CONFLICT (tenant_id, period) DO NOTHING;

  UPDATE public.usage_counters
  SET
    messages_count = messages_count + _messages_delta,
    ai_messages_count = ai_messages_count + _ai_messages_delta,
    threads_count = threads_count + _threads_delta,
    updated_at = now()
  WHERE tenant_id = _tenant_id AND period = _period;
END;
$$;

CREATE TRIGGER handle_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
