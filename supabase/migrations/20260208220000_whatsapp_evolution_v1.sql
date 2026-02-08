-- =============================================
-- WhatsApp V1 Evolution: columns and one connection per tenant
-- Idempotent: add columns, then enforce Evolution-only and unique(tenant_id)
-- =============================================

-- 1. WHATSAPP_CONNECTIONS: add Evolution fields
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS api_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instance_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS webhook_secret text;

ALTER TABLE public.whatsapp_connections
  ALTER COLUMN phone_number DROP NOT NULL;

ALTER TABLE public.whatsapp_connections
  ALTER COLUMN provider SET DEFAULT 'evolution';

-- Drop old provider check and allow only evolution (V1)
ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_provider_check;

ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_provider_mock_check;

ALTER TABLE public.whatsapp_connections
  ADD CONSTRAINT whatsapp_connections_provider_check
  CHECK (provider = 'evolution');

-- One connection per tenant: remove duplicate rows (keep one per tenant), then unique(tenant_id)
DO $$
BEGIN
  DELETE FROM public.whatsapp_connections a
  USING public.whatsapp_connections b
  WHERE a.tenant_id = b.tenant_id AND a.id > b.id;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_tenant_id_name_key;

ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS unique_tenant_name;

DO $$
BEGIN
  ALTER TABLE public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_tenant_id_key UNIQUE (tenant_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 2. WHATSAPP_THREAD_LINKS: add wa_chat_id, contact fields, last_message_at
ALTER TABLE public.whatsapp_thread_links
  ADD COLUMN IF NOT EXISTS wa_chat_id text,
  ADD COLUMN IF NOT EXISTS wa_contact_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wa_contact_name text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

UPDATE public.whatsapp_thread_links
SET wa_chat_id = wa_id
WHERE wa_chat_id IS NULL AND wa_id IS NOT NULL;

UPDATE public.whatsapp_thread_links
SET wa_contact_phone = COALESCE(wa_id, '')
WHERE wa_contact_phone = '' OR wa_contact_phone IS NULL;

ALTER TABLE public.whatsapp_thread_links
  ALTER COLUMN wa_chat_id SET NOT NULL;

-- Drop old unique (tenant_id, connection_id, wa_id) and add new on wa_chat_id
ALTER TABLE public.whatsapp_thread_links
  DROP CONSTRAINT IF EXISTS whatsapp_thread_links_tenant_id_connection_id_wa_id_key;

DO $$
BEGIN
  ALTER TABLE public.whatsapp_thread_links
    ADD CONSTRAINT whatsapp_thread_links_tenant_connection_wa_chat_key
    UNIQUE (tenant_id, connection_id, wa_chat_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Drop wa_id after unique is on wa_chat_id
ALTER TABLE public.whatsapp_thread_links
  DROP COLUMN IF EXISTS wa_id;

CREATE INDEX IF NOT EXISTS idx_whatsapp_thread_links_wa_chat
  ON public.whatsapp_thread_links(tenant_id, connection_id, wa_chat_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_thread_links_tenant_thread
  ON public.whatsapp_thread_links(tenant_id, thread_id);

-- RLS: webhook uses service role (bypass). Policies unchanged for app users.
