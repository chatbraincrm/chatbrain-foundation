import { supabase } from '@/integrations/supabase/client';
import type { Thread, ThreadWithRelations } from '@/types';

export interface ThreadFilters {
  status?: string;
  channel_id?: string;
  assigned_user_id?: string;
}

export async function getTenantThreads(
  tenantId: string,
  filters?: ThreadFilters
): Promise<ThreadWithRelations[]> {
  let query = supabase
    .from('threads')
    .select('*, channels(id, type, name), profiles(id, email, name)')
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.channel_id) {
    query = query.eq('channel_id', filters.channel_id);
  }
  if (filters?.assigned_user_id) {
    query = query.eq('assigned_user_id', filters.assigned_user_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as ThreadWithRelations[];
}

export async function getThread(threadId: string): Promise<ThreadWithRelations | null> {
  const { data, error } = await supabase
    .from('threads')
    .select('*, channels(id, type, name), profiles(id, email, name)')
    .eq('id', threadId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ThreadWithRelations | null;
}

export async function createThread(
  tenantId: string,
  input: {
    channel_id: string;
    subject?: string | null;
    related_entity?: string | null;
    related_entity_id?: string | null;
  }
): Promise<Thread> {
  const { data, error } = await supabase
    .from('threads')
    .insert({
      tenant_id: tenantId,
      channel_id: input.channel_id,
      subject: input.subject || null,
      status: 'open',
      related_entity: input.related_entity || null,
      related_entity_id: input.related_entity_id || null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Thread;
}

export async function assignThread(
  threadId: string,
  userId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('threads')
    .update({ assigned_user_id: userId } as never)
    .eq('id', threadId);
  if (error) throw error;
}

export async function closeThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('threads')
    .update({ status: 'closed' } as never)
    .eq('id', threadId);
  if (error) throw error;
}

export async function reopenThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('threads')
    .update({ status: 'open' } as never)
    .eq('id', threadId);
  if (error) throw error;
}

export async function getLastMessage(
  threadId: string
): Promise<{ content: string; created_at: string } | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as { content: string; created_at: string } | null;
}
