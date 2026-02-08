import { supabase } from '@/lib/supabase';
import type { Lead } from '@/types';

export async function getTenantLeads(tenantId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, companies(id, name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Lead[];
}

export async function getLead(id: string): Promise<Lead & { companies?: { id: string; name: string } | null }> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, companies(id, name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function createLead(tenantId: string, input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  company_id?: string | null;
}): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source || null,
      company_id: input.company_id || null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Lead;
}

export async function updateLead(id: string, input: Partial<{
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  company_id: string | null;
}>): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update(input as never)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
