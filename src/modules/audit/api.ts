import { supabase } from '@/lib/supabase';

export async function getTenantAuditLogs(tenantId: string, page = 0, limit = 25) {
  const from = page * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*, profiles(email, name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function createAuditLog(
  tenantId: string,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.rpc('log_audit_event' as never, {
    _tenant_id: tenantId,
    _action: action,
    _entity: entity ?? null,
    _entity_id: entityId ?? null,
    _metadata: metadata ?? null,
  } as never);
  if (error) throw error;
}
