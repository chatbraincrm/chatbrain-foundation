import { supabase } from '@/lib/supabase';

export interface UnreadCount {
  thread_id: string;
  unread_count: number;
}

export async function getUnreadCounts(tenantId: string): Promise<UnreadCount[]> {
  const { data, error } = await supabase.rpc('get_unread_counts', {
    _tenant_id: tenantId,
  });
  if (error) throw error;
  return (data || []) as unknown as UnreadCount[];
}

export async function markThreadRead(tenantId: string, threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_thread_read', {
    _tenant_id: tenantId,
    _thread_id: threadId,
  });
  if (error) throw error;
}
