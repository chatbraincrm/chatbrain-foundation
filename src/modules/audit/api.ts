import { supabase } from '@/integrations/supabase/client';

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action,
    entity,
    entity_id: entityId,
    metadata,
  } as never);
  if (error) throw error;
}
