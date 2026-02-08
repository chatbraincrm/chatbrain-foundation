import { supabase } from '@/integrations/supabase/client';
import type { Company } from '@/types';

export async function getTenantCompanies(tenantId: string): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return (data || []) as unknown as Company[];
}

export async function getCompany(id: string): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Company;
}

export async function createCompany(tenantId: string, input: { name: string; website?: string | null }): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .insert({ tenant_id: tenantId, name: input.name, website: input.website || null } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Company;
}

export async function updateCompany(id: string, input: { name?: string; website?: string | null }): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update(input as never)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
