import { supabase } from '@/integrations/supabase/client';

export async function getTenantInvites(tenantId: string) {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInvite(tenantId: string, email: string, role: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from('invites')
    .insert({
      tenant_id: tenantId,
      email,
      role,
      expires_at: expiresAt.toISOString(),
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInvite(id: string) {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}

export async function acceptInvite(token: string) {
  const { data, error } = await supabase.rpc('accept_invite' as never, {
    _token: token,
  } as never);
  if (error) throw error;
  const result = data as unknown as { ok: boolean; data?: { membership_id: string; tenant_id: string }; error?: { message: string } };
  if (!result.ok) throw new Error(result.error?.message || 'Erro ao aceitar convite');
  return result.data!;
}
