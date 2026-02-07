import { supabase } from '@/integrations/supabase/client';

export async function getTenantMemberships(tenantId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('*, profiles(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateMembershipRole(id: string, role: string) {
  const { data, error } = await supabase
    .from('memberships')
    .update({ role } as never)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMembership(id: string) {
  const { error } = await supabase.from('memberships').delete().eq('id', id);
  if (error) throw error;
}
