import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { trySendWhatsAppOutbound } from '@/modules/whatsapp/whatsapp-api';
import { incrementMessageUsage, canSendMessage } from '@/modules/billing/usage-api';
import type { Message, MessageWithProfile } from '@/types';

export async function getThreadMessages(
  threadId: string,
  client?: SupabaseClient
): Promise<MessageWithProfile[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('messages')
    .select('*, profiles(id, email, name)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as MessageWithProfile[];
}

export async function sendMessage(
  tenantId: string,
  threadId: string,
  content: string,
  senderUserId: string
): Promise<Message> {
  const allowed = await canSendMessage(tenantId);
  if (!allowed) {
    throw new Error('Você atingiu o limite do seu plano ChatBrain Pro. Entre em contato com o suporte para continuar atendendo.');
  }
  await trySendWhatsAppOutbound(tenantId, threadId, content);

  // Insert the message
  const { data, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      content,
      sender_type: 'user',
      sender_user_id: senderUserId,
    } as never)
    .select()
    .single();
  if (error) throw error;

  const message = data as unknown as Message;

  // Update thread last_message_at
  await supabase
    .from('threads')
    .update({ last_message_at: message.created_at } as never)
    .eq('id', threadId);

  try {
    await incrementMessageUsage(tenantId);
  } catch (usageErr) {
    console.warn('[messages-api] incrementMessageUsage failed, skipping:', usageErr);
  }

  // Log message event via RPC (fail-safe – may not exist on external Supabase)
  try {
    await supabase.rpc('log_message_event' as never, {
      _tenant_id: tenantId,
      _thread_id: threadId,
      _message_id: message.id,
      _sender_type: 'user',
    } as never);
  } catch (rpcErr) {
    console.warn('[messages-api] log_message_event RPC unavailable, skipping:', rpcErr);
  }

  return message;
}

/**
 * Inserts an AI agent message via RPC (SECURITY DEFINER). Validates tenant, thread, channel, handoff and agent state server-side.
 */
export async function insertAiMessage(
  tenantId: string,
  threadId: string,
  content: string,
  client?: SupabaseClient
): Promise<void> {
  const db = client ?? supabase;
  const { error } = await db.rpc('insert_ai_message' as never, {
    _tenant_id: tenantId,
    _thread_id: threadId,
    _content: content,
  } as never);
  if (error) throw error;
}
