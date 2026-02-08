import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { markLatestAgentActivityInterrupted } from '@/modules/ai-agent/ai-agent-api';

export interface ThreadHandoff {
  id: string;
  tenant_id: string;
  thread_id: string;
  is_handed_off: boolean;
  handed_off_at: string | null;
  handed_off_by: string | null;
  created_at: string;
}

export async function getThreadHandoff(
  tenantId: string,
  threadId: string,
  client?: SupabaseClient
): Promise<ThreadHandoff | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('thread_handoffs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .maybeSingle();
  if (error) throw error;
  return data as ThreadHandoff | null;
}

/** Batch fetch handoffs for multiple threads (e.g. for Inbox list badges). */
export async function getHandoffsForThreads(
  tenantId: string,
  threadIds: string[],
  client?: SupabaseClient
): Promise<Record<string, ThreadHandoff>> {
  if (threadIds.length === 0) return {};
  const db = client ?? supabase;
  const { data, error } = await db
    .from('thread_handoffs')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('thread_id', threadIds);
  if (error) throw error;
  const map: Record<string, ThreadHandoff> = {};
  for (const row of (data || []) as ThreadHandoff[]) {
    map[row.thread_id] = row;
  }
  return map;
}

export async function setHandoff(
  tenantId: string,
  threadId: string,
  isHandedOff: boolean,
  userId: string | null
): Promise<ThreadHandoff> {
  const { data, error } = await supabase
    .from('thread_handoffs')
    .upsert(
      {
        tenant_id: tenantId,
        thread_id: threadId,
        is_handed_off: isHandedOff,
        handed_off_at: isHandedOff ? new Date().toISOString() : null,
        handed_off_by: isHandedOff ? userId : null,
      } as never,
      { onConflict: 'thread_id' }
    )
    .select()
    .single();
  if (error) throw error;
  if (isHandedOff) {
    markLatestAgentActivityInterrupted(tenantId, threadId).catch(() => {});
  }
  return data as ThreadHandoff;
}
