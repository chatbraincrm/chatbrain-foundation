import { supabase } from '@/lib/supabase';
import type { ActivityTimelineWithProfile } from '@/types';

export async function getEntityTimeline(tenantId: string, entity: string, entityId: string): Promise<ActivityTimelineWithProfile[]> {
  const { data, error } = await supabase
    .from('activity_timeline')
    .select('*, profiles(email, name)')
    .eq('tenant_id', tenantId)
    .eq('entity', entity)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as ActivityTimelineWithProfile[];
}

export async function logActivityEvent(
  tenantId: string,
  entity: string,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_activity_event' as never, {
      _tenant_id: tenantId,
      _entity: entity,
      _entity_id: entityId,
      _action: action,
      _metadata: metadata ?? null,
    } as never);
    if (error) throw error;
  } catch (err) {
    console.warn('[timeline] log_activity_event RPC unavailable, skipping:', err);
  }
}
