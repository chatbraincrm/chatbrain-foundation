-- =============================================
-- Thread handoffs + Appointments + insert_ai_message RPC
-- Idempotent: tables IF NOT EXISTS, policies in DO ... EXCEPTION WHEN duplicate_object
-- =============================================

-- 1. THREAD_HANDOFFS (table first, then RLS, then policies)
CREATE TABLE IF NOT EXISTS public.thread_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  is_handed_off boolean NOT NULL DEFAULT false,
  handed_off_at timestamptz,
  handed_off_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id)
);

ALTER TABLE public.thread_handoffs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Members can view tenant thread_handoffs"
    ON public.thread_handoffs FOR SELECT
    USING (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can insert thread_handoffs"
    ON public.thread_handoffs FOR INSERT
    WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can update thread_handoffs"
    ON public.thread_handoffs FOR UPDATE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can delete thread_handoffs"
    ON public.thread_handoffs FOR DELETE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  related_entity text,
  related_entity_id uuid,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'cancelled', 'rescheduled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_thread_id ON public.appointments(thread_id);

DO $$
BEGIN
  CREATE TRIGGER handle_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Members can view tenant appointments"
    ON public.appointments FOR SELECT
    USING (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager/agent can insert appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager/agent can update appointments"
    ON public.appointments FOR UPDATE
    USING (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can delete appointments"
    ON public.appointments FOR DELETE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. RPC insert_ai_message (SECURITY DEFINER)
-- Inserts only: tenant_id, thread_id, sender_type='system', sender_subtype='ai', content.
-- messages.sender_user_id is left NULL for agent messages (schema allows null).
CREATE OR REPLACE FUNCTION public.insert_ai_message(
  _tenant_id uuid,
  _thread_id uuid,
  _content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _thread_tenant_id uuid;
  _channel_type text;
  _handed_off boolean;
  _agent_active boolean;
  _internal_enabled boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Not a member of this tenant';
  END IF;

  SELECT t.tenant_id, c.type
  INTO _thread_tenant_id, _channel_type
  FROM public.threads t
  JOIN public.channels c ON c.id = t.channel_id
  WHERE t.id = _thread_id;

  IF _thread_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;
  IF _thread_tenant_id != _tenant_id THEN
    RAISE EXCEPTION 'Thread does not belong to this tenant';
  END IF;
  IF _channel_type != 'internal' THEN
    RAISE EXCEPTION 'Agent messages only allowed on internal channel';
  END IF;

  SELECT COALESCE(h.is_handed_off, false) INTO _handed_off
  FROM public.thread_handoffs h
  WHERE h.thread_id = _thread_id;
  IF _handed_off THEN
    RAISE EXCEPTION 'Thread is handed off to human';
  END IF;

  SELECT a.is_active INTO _agent_active
  FROM public.ai_agents a
  WHERE a.tenant_id = _tenant_id
  LIMIT 1;
  IF NOT FOUND OR NOT _agent_active THEN
    RAISE EXCEPTION 'No active agent for tenant';
  END IF;

  SELECT (EXISTS (
    SELECT 1 FROM public.ai_agent_channels ac
    JOIN public.ai_agents a ON a.id = ac.agent_id
    WHERE a.tenant_id = _tenant_id AND ac.channel_type = 'internal' AND ac.is_enabled = true
  )) INTO _internal_enabled;
  IF NOT _internal_enabled THEN
    RAISE EXCEPTION 'Agent not enabled for internal channel';
  END IF;

  INSERT INTO public.messages (tenant_id, thread_id, sender_type, sender_subtype, content)
  VALUES (_tenant_id, _thread_id, 'system', 'ai', _content);

  UPDATE public.threads
  SET last_message_at = now()
  WHERE id = _thread_id;
END;
$$;
