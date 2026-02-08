
-- =============================================
-- ETAPA 3: INBOX - Channels, Threads, Messages
-- =============================================

-- 1. CHANNELS TABLE
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  type text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, type, name)
);

CREATE TRIGGER handle_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant channels"
  ON public.channels FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin can insert channels"
  ON public.channels FOR INSERT
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admin can update channels"
  ON public.channels FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admin can delete channels"
  ON public.channels FOR DELETE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 2. THREADS TABLE
CREATE TABLE public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel_id uuid NOT NULL REFERENCES public.channels(id),
  subject text,
  status text NOT NULL DEFAULT 'open',
  assigned_user_id uuid REFERENCES public.profiles(id),
  related_entity text,
  related_entity_id uuid,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_tenant_id ON public.threads(tenant_id);
CREATE INDEX idx_threads_channel_id ON public.threads(channel_id);
CREATE INDEX idx_threads_status ON public.threads(status);
CREATE INDEX idx_threads_assigned_user_id ON public.threads(assigned_user_id);

CREATE TRIGGER handle_threads_updated_at
  BEFORE UPDATE ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant threads"
  ON public.threads FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert threads"
  ON public.threads FOR INSERT
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can insert threads"
  ON public.threads FOR INSERT
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'agent'::app_role));

CREATE POLICY "Admin/manager can update threads"
  ON public.threads FOR UPDATE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Agent can update assigned threads"
  ON public.threads FOR UPDATE
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'agent'::app_role)
    AND (assigned_user_id = auth.uid() OR assigned_user_id IS NULL)
  );

CREATE POLICY "Admin/manager can delete threads"
  ON public.threads FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 3. THREAD_PARTICIPANTS TABLE
CREATE TABLE public.thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant participants"
  ON public.thread_participants FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can insert participants"
  ON public.thread_participants FOR INSERT
  WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete participants"
  ON public.thread_participants FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 4. MESSAGES TABLE
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_user_id uuid REFERENCES public.profiles(id),
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tenant messages"
  ON public.messages FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can update messages"
  ON public.messages FOR UPDATE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

CREATE POLICY "Admin/manager can delete messages"
  ON public.messages FOR DELETE
  USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));

-- 5. RPC: log_message_event
CREATE OR REPLACE FUNCTION public.log_message_event(
  _tenant_id uuid,
  _thread_id uuid,
  _message_id uuid,
  _sender_type text
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
  VALUES (
    _tenant_id,
    _user_id,
    'thread',
    _thread_id::text,
    'message.sent',
    jsonb_build_object('message_id', _message_id, 'sender_type', _sender_type)
  );
END;
$$;

-- 6. UPDATE create_tenant_with_admin to add default internal channel
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

  -- Create default internal channel
  INSERT INTO public.channels (tenant_id, type, name) VALUES (_tenant_id, 'internal', 'Interno');

  INSERT INTO public.audit_logs (tenant_id, actor_user_id, action, entity, entity_id, metadata)
  VALUES (_tenant_id, _user_id, 'tenant.created', 'tenant', _tenant_id::text, jsonb_build_object('name', _name, 'slug', _slug));
  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('tenant_id', _tenant_id));
END;
$$;

-- 7. Enable realtime for messages (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
