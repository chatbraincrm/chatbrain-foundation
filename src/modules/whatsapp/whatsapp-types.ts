/** V1: only evolution */
export type WhatsAppProvider = 'evolution';

export interface WhatsAppConnection {
  id: string;
  tenant_id: string;
  provider: WhatsAppProvider;
  name: string;
  is_active: boolean;
  base_url: string;
  api_key: string;
  phone_number: string | null;
  instance_name: string;
  webhook_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppContact {
  id: string;
  tenant_id: string;
  connection_id: string;
  wa_id: string;
  name: string | null;
  phone_e164: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppThreadLink {
  id: string;
  tenant_id: string;
  connection_id: string;
  thread_id: string;
  wa_chat_id: string;
  wa_contact_phone: string;
  wa_contact_name: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}
