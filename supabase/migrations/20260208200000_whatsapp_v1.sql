-- =============================================
-- WhatsApp V1: connections, contacts, thread_links
-- Idempotent: tables IF NOT EXISTS, policies in DO ... EXCEPTION
-- =============================================

-- 1. WHATSAPP_CONNECTIONS
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('meta_cloud', 'evolution')),
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_tenant ON public.whatsapp_connections(tenant_id);

DO $$
BEGIN
  CREATE TRIGGER handle_whatsapp_connections_updated_at
    BEFORE UPDATE ON public.whatsapp_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Members can view tenant whatsapp_connections"
    ON public.whatsapp_connections FOR SELECT
    USING (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can insert whatsapp_connections"
    ON public.whatsapp_connections FOR INSERT
    WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can update whatsapp_connections"
    ON public.whatsapp_connections FOR UPDATE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can delete whatsapp_connections"
    ON public.whatsapp_connections FOR DELETE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. WHATSAPP_CONTACTS
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  name text,
  phone_e164 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connection_id, wa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_tenant_connection ON public.whatsapp_contacts(tenant_id, connection_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_wa_id ON public.whatsapp_contacts(connection_id, wa_id);

DO $$
BEGIN
  CREATE TRIGGER handle_whatsapp_contacts_updated_at
    BEFORE UPDATE ON public.whatsapp_contacts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Members can view tenant whatsapp_contacts"
    ON public.whatsapp_contacts FOR SELECT
    USING (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can insert whatsapp_contacts"
    ON public.whatsapp_contacts FOR INSERT
    WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can update whatsapp_contacts"
    ON public.whatsapp_contacts FOR UPDATE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can delete whatsapp_contacts"
    ON public.whatsapp_contacts FOR DELETE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. WHATSAPP_THREAD_LINKS
CREATE TABLE IF NOT EXISTS public.whatsapp_thread_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connection_id, wa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_thread_links_tenant_connection ON public.whatsapp_thread_links(tenant_id, connection_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_thread_links_thread ON public.whatsapp_thread_links(thread_id);

DO $$
BEGIN
  CREATE TRIGGER handle_whatsapp_thread_links_updated_at
    BEFORE UPDATE ON public.whatsapp_thread_links
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.whatsapp_thread_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Members can view tenant whatsapp_thread_links"
    ON public.whatsapp_thread_links FOR SELECT
    USING (public.is_tenant_member(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can insert whatsapp_thread_links"
    ON public.whatsapp_thread_links FOR INSERT
    WITH CHECK (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can update whatsapp_thread_links"
    ON public.whatsapp_thread_links FOR UPDATE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin/manager can delete whatsapp_thread_links"
    ON public.whatsapp_thread_links FOR DELETE
    USING (public.is_tenant_admin_or_manager(auth.uid(), tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
