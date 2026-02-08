-- Allow provider 'mock' for local/test Inbox simulation (V1)
ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_provider_check;

ALTER TABLE public.whatsapp_connections
  ADD CONSTRAINT whatsapp_connections_provider_check
  CHECK (provider IN ('meta_cloud', 'evolution', 'mock'));
