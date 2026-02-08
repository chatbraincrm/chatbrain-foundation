import { supabase } from '@/lib/supabase';

export interface UnreadCount {
  thread_id: string;
  unread_count: number;
}

/**
 * Computes unread message counts per thread using standard queries
 * instead of a database RPC, for compatibility with external Supabase instances.
 */
export async function getUnreadCounts(tenantId: string): Promise<UnreadCount[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Get the user's last-read timestamps per thread
  const { data: reads, error: readsError } = await supabase
    .from('thread_reads')
    .select('thread_id, last_read_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id);

  if (readsError) {
    console.error('Failed to fetch thread reads:', readsError);
    return [];
  }

  const readMap = new Map<string, string>();
  (reads || []).forEach(r => readMap.set(r.thread_id, r.last_read_at));

  // 2. Fetch recent messages (not from current user) for this tenant
  const { data: messages, error: msgsError } = await supabase
    .from('messages')
    .select('thread_id, created_at, sender_user_id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (msgsError) {
    console.error('Failed to fetch messages:', msgsError);
    return [];
  }

  if (!messages || messages.length === 0) return [];

  // 3. Count unread messages per thread (sender IS DISTINCT FROM current user)
  const countMap = new Map<string, number>();
  for (const msg of messages) {
    if (msg.sender_user_id === user.id) continue;

    const lastRead = readMap.get(msg.thread_id);
    if (!lastRead || msg.created_at > lastRead) {
      countMap.set(msg.thread_id, (countMap.get(msg.thread_id) || 0) + 1);
    }
  }

  return Array.from(countMap.entries())
    .filter(([, count]) => count > 0)
    .map(([thread_id, unread_count]) => ({ thread_id, unread_count }));
}

/**
 * Marks a thread as read by upserting thread_reads with the current timestamp.
 */
export async function markThreadRead(tenantId: string, threadId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('thread_reads')
    .upsert(
      {
        tenant_id: tenantId,
        thread_id: threadId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'thread_id,user_id' }
    );

  if (error) throw error;
}
