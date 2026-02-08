import { supabase } from '@/lib/supabase';
import type { Message, MessageWithProfile } from '@/types';

export async function getThreadMessages(
  threadId: string
): Promise<MessageWithProfile[]> {
  const { data, error } = await supabase
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

  // Log message event via RPC
  await supabase.rpc('log_message_event' as never, {
    _tenant_id: tenantId,
    _thread_id: threadId,
    _message_id: message.id,
    _sender_type: 'user',
  } as never);

  return message;
}
