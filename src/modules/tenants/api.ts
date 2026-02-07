import { supabase } from '@/integrations/supabase/client';
import type { Tenant } from '@/types';

export async function getTenantById(id: string): Promise<Tenant> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Tenant;
}

export async function createTenantWithAdmin(name: string, slug: string) {
  const { data, error } = await supabase.rpc('create_tenant_with_admin' as never, {
    _name: name,
    _slug: slug,
  } as never);
  if (error) throw error;
  const result = data as unknown as { ok: boolean; data?: { tenant_id: string }; error?: { message: string } };
  if (!result.ok) throw new Error(result.error?.message || 'Erro ao criar workspace');
  return result.data!;
}

export async function updateTenant(id: string, name: string): Promise<Tenant> {
  const { data, error } = await supabase
    .from('tenants')
    .update({ name } as never)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Tenant;
}
