import { supabase } from '@/integrations/supabase/client';
import type { Deal, DealWithRelations } from '@/types';

export async function getTenantDeals(tenantId: string, pipelineId?: string): Promise<DealWithRelations[]> {
  let query = supabase
    .from('deals')
    .select('*, pipeline_stages(id, name, position, color), leads(id, name, email), companies(id, name), profiles(id, email, name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (pipelineId) {
    query = query.eq('pipeline_id', pipelineId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as DealWithRelations[];
}

export async function getDeal(id: string): Promise<DealWithRelations> {
  const { data, error } = await supabase
    .from('deals')
    .select('*, pipeline_stages(id, name, position, color), leads(id, name, email), companies(id, name), profiles(id, email, name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as DealWithRelations;
}

export async function createDeal(tenantId: string, input: {
  title: string;
  pipeline_id: string;
  stage_id: string;
  lead_id?: string | null;
  company_id?: string | null;
  value_cents?: number;
  currency?: string;
  owner_user_id?: string | null;
}): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .insert({
      tenant_id: tenantId,
      title: input.title,
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      lead_id: input.lead_id || null,
      company_id: input.company_id || null,
      value_cents: input.value_cents ?? 0,
      currency: input.currency ?? 'BRL',
      owner_user_id: input.owner_user_id || null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Deal;
}

export async function updateDeal(id: string, input: Partial<{
  title: string;
  stage_id: string;
  lead_id: string | null;
  company_id: string | null;
  value_cents: number;
  currency: string;
  owner_user_id: string | null;
}>): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .update(input as never)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
