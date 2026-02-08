import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getTenantChannels, createChannel } from '@/modules/inbox/channels-api';
import { createThread } from '@/modules/inbox/threads-api';
import type { WhatsAppConnection, WhatsAppThreadLink } from './whatsapp-types';
import type { UpsertEvolutionConnectionInput } from './whatsapp-validators';
import type { Thread } from '@/types';
import { sendTextMessage } from './providers/evolution-client';

/** Get the single Evolution connection for the tenant (V1: one per tenant). */
export async function getConnectionByTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<WhatsAppConnection | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('whatsapp_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as WhatsAppConnection | null;
}

/** Get connection by id (for webhook and internal use). */
export async function getConnection(
  tenantId: string,
  connectionId: string,
  client?: SupabaseClient
): Promise<WhatsAppConnection | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('whatsapp_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', connectionId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as WhatsAppConnection | null;
}

/** Upsert Evolution connection (one per tenant). If api_key is empty, keep existing. */
export async function upsertEvolutionConnection(
  tenantId: string,
  input: UpsertEvolutionConnectionInput,
  existingApiKey?: string | null
): Promise<WhatsAppConnection> {
  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    provider: 'evolution',
    name: input.name ?? 'WhatsApp Principal',
    is_active: input.is_active ?? false,
    base_url: (input.base_url ?? '').trim() || '',
    instance_name: (input.instance_name ?? '').trim(),
    phone_number: input.phone_number ?? null,
    webhook_secret: input.webhook_secret ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.api_key != null && input.api_key.trim() !== '') {
    payload.api_key = input.api_key.trim();
  } else if (existingApiKey != null) {
    payload.api_key = existingApiKey;
  }
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .upsert(payload as never, { onConflict: 'tenant_id' })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as WhatsAppConnection;
}

export async function getThreadLink(
  tenantId: string,
  connectionId: string,
  waChatId: string,
  client?: SupabaseClient
): Promise<WhatsAppThreadLink | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('whatsapp_thread_links')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('connection_id', connectionId)
    .eq('wa_chat_id', waChatId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as WhatsAppThreadLink | null;
}

/** Get thread link by thread_id (for outbound and UI). */
export async function getThreadLinkByThreadId(
  tenantId: string,
  threadId: string,
  client?: SupabaseClient
): Promise<WhatsAppThreadLink | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('whatsapp_thread_links')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as WhatsAppThreadLink | null;
}

export async function linkThread(
  tenantId: string,
  connectionId: string,
  waChatId: string,
  waContactPhone: string,
  waContactName: string | null,
  threadId: string,
  client?: SupabaseClient
): Promise<WhatsAppThreadLink> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('whatsapp_thread_links')
    .upsert(
      {
        tenant_id: tenantId,
        connection_id: connectionId,
        wa_chat_id: waChatId,
        wa_contact_phone: waContactPhone,
        wa_contact_name: waContactName,
        thread_id: threadId,
      } as never,
      { onConflict: 'tenant_id,connection_id,wa_chat_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as unknown as WhatsAppThreadLink;
}

/**
 * Gets or creates a thread for a WhatsApp contact (wa_chat_id) on a connection.
 */
export async function getOrCreateThreadForContact(
  tenantId: string,
  connectionId: string,
  waChatId: string,
  waContactPhone: string,
  waContactName: string | null,
  subject?: string | null,
  client?: SupabaseClient
): Promise<Thread> {
  const db = client ?? supabase;
  const existing = await getThreadLink(tenantId, connectionId, waChatId, db);
  if (existing) {
    const { data, error } = await db
      .from('threads')
      .select('*')
      .eq('id', existing.thread_id)
      .single();
    if (error) throw error;
    return data as unknown as Thread;
  }

  const channels = await getTenantChannels(tenantId);
  let whatsappChannel = channels.find((c) => c.type === 'whatsapp');
  if (!whatsappChannel) {
    whatsappChannel = await createChannel(tenantId, 'whatsapp', 'WhatsApp');
  }

  const thread = await createThread(tenantId, {
    channel_id: whatsappChannel.id,
    subject: subject ?? (waContactName || waContactPhone || `WhatsApp ${waChatId}`),
  });

  await linkThread(tenantId, connectionId, waChatId, waContactPhone, waContactName, thread.id, db);
  return thread;
}

/** Flag to enable sending outbound messages via Evolution. Set ENABLE_WHATSAPP_OUTBOUND=true or VITE_ENABLE_WHATSAPP_OUTBOUND=true */
function getEnableWhatsAppOutbound(): boolean {
  if (typeof process !== 'undefined' && process.env?.ENABLE_WHATSAPP_OUTBOUND === 'true') return true;
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENABLE_WHATSAPP_OUTBOUND === 'true') return true;
  return false;
}
export const ENABLE_WHATSAPP_OUTBOUND = getEnableWhatsAppOutbound();

/**
 * If the thread is linked to WhatsApp and connection is active, sends the message via Evolution.
 * Does not insert the message (caller must call sendMessage). On failure logs warn, does not throw.
 */
export async function trySendWhatsAppOutbound(
  tenantId: string,
  threadId: string,
  content: string,
  client?: SupabaseClient
): Promise<void> {
  if (!ENABLE_WHATSAPP_OUTBOUND) return;
  const db = client ?? supabase;
  const link = await getThreadLinkByThreadId(tenantId, threadId, db);
  if (!link) return;
  const connection = await getConnection(tenantId, link.connection_id, db);
  if (!connection || !connection.is_active) return;
  const baseUrl =
    connection.base_url?.trim() ||
    (typeof process !== 'undefined' && process.env?.EVOLUTION_BASE_URL?.trim()) ||
    '';
  const apiKey =
    connection.api_key?.trim() ||
    (typeof process !== 'undefined' && process.env?.EVOLUTION_API_KEY?.trim()) ||
    '';
  if (!baseUrl || !apiKey) {
    console.warn('[whatsapp] trySendWhatsAppOutbound: missing base_url or api_key (connection or env EVOLUTION_*)');
    return;
  }
  try {
    const result = await sendTextMessage(
      baseUrl,
      apiKey,
      connection.instance_name,
      link.wa_chat_id,
      content
    );
    if (!result.ok) {
      console.warn('[whatsapp] trySendWhatsAppOutbound failed:', result.error);
    }
  } catch (err) {
    console.warn('[whatsapp] trySendWhatsAppOutbound failed:', err);
  }
}
