import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppConnection } from './whatsapp-types';
import type { ParsedInboundMessage, WebhookRequest } from './providers/types';
import { runAiAgentAfterInbound } from '@/modules/inbox/run-agent';

/**
 * Process an inbound WhatsApp message: get/create thread (by wa_chat_id), insert message,
 * update thread last_message_at and thread link last_message_at, register timeline.
 * Uses the provided Supabase client (e.g. service role in webhook).
 */
export async function processInboundMessage(
  client: SupabaseClient,
  connection: WhatsAppConnection,
  parsed: ParsedInboundMessage
): Promise<void> {
  const tenantId = connection.tenant_id;
  const connectionId = connection.id;
  const waChatId = parsed.wa_id;
  const waContactPhone = parsed.wa_id.includes('@') ? parsed.wa_id.split('@')[0]! : parsed.wa_id;
  const waContactName = parsed.name ?? null;

  const thread = await getOrCreateThreadForContactWithClient(
    client,
    tenantId,
    connectionId,
    waChatId,
    waContactPhone,
    waContactName
  );

  let content: string;
  if (parsed.text && parsed.text.trim()) {
    content = parsed.text.trim();
  } else if (parsed.media?.length) {
    const parts = parsed.media.map((m) => {
      if (m.type === 'audio') return '[audio]';
      if (m.type === 'image') return '[image]';
      if (m.type === 'video') return '[video]';
      if (m.type === 'document') return '[document]';
      return `[${m.type}]`;
    });
    content = parts.join(' ');
  } else {
    content = '(mensagem vazia)';
  }

  const { data: message, error: msgError } = await client
    .from('messages')
    .insert({
      tenant_id: tenantId,
      thread_id: thread.id,
      sender_type: 'external',
      sender_subtype: 'whatsapp',
      content,
    } as never)
    .select('id, created_at')
    .single();
  if (msgError) throw msgError;

  await client
    .from('threads')
    .update({ last_message_at: message.created_at } as never)
    .eq('id', thread.id);

  await client
    .from('whatsapp_thread_links')
    .update({ last_message_at: message.created_at } as never)
    .eq('tenant_id', tenantId)
    .eq('connection_id', connectionId)
    .eq('wa_chat_id', waChatId);

  try {
    await client.rpc('log_message_event' as never, {
      _tenant_id: tenantId,
      _thread_id: thread.id,
      _message_id: message.id,
      _sender_type: 'external',
    } as never);
  } catch {
    // ignore
  }
}

async function getOrCreateThreadForContactWithClient(
  client: SupabaseClient,
  tenantId: string,
  connectionId: string,
  waChatId: string,
  waContactPhone: string,
  waContactName: string | null
): Promise<{ id: string }> {
  const { data: existing } = await client
    .from('whatsapp_thread_links')
    .select('thread_id')
    .eq('tenant_id', tenantId)
    .eq('connection_id', connectionId)
    .eq('wa_chat_id', waChatId)
    .maybeSingle();

  if (existing) {
    return { id: existing.thread_id };
  }

  const { data: channels } = await client
    .from('channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'whatsapp');
  let channelId = channels?.[0]?.id;
  if (!channelId) {
    const { data: newChannel, error: chErr } = await client
      .from('channels')
      .insert({
        tenant_id: tenantId,
        type: 'whatsapp',
        name: 'WhatsApp',
        is_active: true,
      } as never)
      .select('id')
      .single();
    if (chErr) throw chErr;
    channelId = newChannel.id;
  }

  const subject = waContactName || waContactPhone || `WhatsApp ${waChatId}`;
  const { data: thread, error: threadErr } = await client
    .from('threads')
    .insert({
      tenant_id: tenantId,
      channel_id: channelId,
      subject,
      status: 'open',
    } as never)
    .select('id')
    .single();
  if (threadErr) throw threadErr;

  await client.from('whatsapp_thread_links').upsert(
    {
      tenant_id: tenantId,
      connection_id: connectionId,
      wa_chat_id: waChatId,
      wa_contact_phone: waContactPhone,
      wa_contact_name: waContactName,
      thread_id: thread.id,
    } as never,
    { onConflict: 'tenant_id,connection_id,wa_chat_id' }
  );

  return { id: thread.id };
}

export interface HandleWebhookResult {
  status: number;
  body?: string;
  headers?: Record<string, string>;
}

export interface HandleWebhookOptions {
  getOpenAiKey?: () => string | null;
}

/**
 * Handle a webhook request (POST only for Evolution). Uses connection.webhook_secret.
 * After inserting inbound message, triggers AI agent run in background.
 */
export async function handleWebhookRequest(
  client: SupabaseClient,
  connectionId: string,
  req: WebhookRequest,
  options?: HandleWebhookOptions
): Promise<HandleWebhookResult> {
  const { data: connection, error: connError } = await client
    .from('whatsapp_connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle();

  if (connError || !connection) {
    return { status: 404 };
  }

  const conn = connection as unknown as WhatsAppConnection;

  if (req.method !== 'POST') {
    return { status: 200 };
  }

  const parsed = await parseEvolutionInbound(req);
  if (parsed) {
    try {
      await processInboundMessage(client, conn, parsed);
      const tenantId = conn.tenant_id;
      const { data: link } = await client
        .from('whatsapp_thread_links')
        .select('thread_id')
        .eq('tenant_id', tenantId)
        .eq('connection_id', connectionId)
        .eq('wa_chat_id', parsed.wa_id)
        .maybeSingle();
      if (link?.thread_id) {
        runAiAgentAfterInbound(tenantId, link.thread_id, client, options?.getOpenAiKey).catch((err) => {
          console.error('[whatsapp-webhook] runAiAgentAfterInbound:', err);
        });
      }
    } catch (err) {
      console.error('[whatsapp-webhook] processInboundMessage:', err);
    }
  }
  return { status: 200 };
}

/** Parse Evolution API webhook payload into ParsedInboundMessage. */
function parseEvolutionInbound(req: WebhookRequest): ParsedInboundMessage | null {
  let data: unknown = req.body;
  if (!data && req.rawBody) {
    try {
      data = JSON.parse(req.rawBody) as unknown;
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const ev = (o.data as Record<string, unknown>) ?? o;
  const key = ev.key as Record<string, unknown> | undefined;
  const remoteJid = (key?.remoteJid as string) ?? (ev.remoteJid as string);
  if (!remoteJid || typeof remoteJid !== 'string') return null;
  const message = (ev.message as Record<string, unknown>) ?? ev;
  let text: string | null = null;
  let media: { type: 'audio' | 'image' | 'video' | 'document'; url?: string }[] | undefined;
  if (message.conversation && typeof message.conversation === 'string') {
    text = message.conversation;
  } else if (message.extendedTextMessage && typeof (message.extendedTextMessage as any).text === 'string') {
    text = (message.extendedTextMessage as { text: string }).text;
  } else if (message.audioMessage) {
    media = [{ type: 'audio' }];
  } else if (message.imageMessage) {
    media = [{ type: 'image' }];
  } else if (message.videoMessage) {
    media = [{ type: 'video' }];
  } else if (message.documentMessage) {
    media = [{ type: 'document' }];
  }
  const pushName = (ev.pushName as string) ?? (key?.fromMe === true ? null : null);
  const connectionId = (ev.connectionId as string) ?? (o.connectionId as string) ?? '';
  return {
    connectionId,
    wa_id: remoteJid,
    name: pushName ?? null,
    text,
    media,
  };
}

export function buildWebhookRequest(params: {
  method: string;
  url: string;
  rawBody: string;
  body?: unknown;
}): WebhookRequest {
  const url = new URL(params.url, 'http://localhost');
  return {
    method: params.method,
    searchParams: url.searchParams,
    rawBody: params.rawBody,
    body: params.body,
  };
}
