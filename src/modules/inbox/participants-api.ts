import { supabase } from '@/integrations/supabase/client';
import type { ThreadParticipant, ThreadParticipantWithProfile } from '@/types';

export async function getThreadParticipants(
  threadId: string
): Promise<ThreadParticipantWithProfile[]> {
  const { data, error } = await supabase
    .from('thread_participants')
    .select('*, profiles(id, email, name)')
    .eq('thread_id', threadId);
  if (error) throw error;
  return (data || []) as unknown as ThreadParticipantWithProfile[];
}

export async function addParticipant(
  tenantId: string,
  threadId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('thread_participants')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      user_id: userId,
    } as never);
  if (error) throw error;
}

export async function removeParticipant(participantId: string): Promise<void> {
  const { error } = await supabase
    .from('thread_participants')
    .delete()
    .eq('id', participantId);
  if (error) throw error;
}
