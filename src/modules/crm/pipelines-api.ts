import { supabase } from '@/lib/supabase';
import type { Pipeline, PipelineStage } from '@/types';

export async function getTenantPipelines(tenantId: string): Promise<Pipeline[]> {
  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as unknown as Pipeline[];
}

export async function createPipeline(tenantId: string, name: string): Promise<Pipeline> {
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ tenant_id: tenantId, name } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Pipeline;
}

export async function updatePipeline(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('pipelines')
    .update({ name } as never)
    .eq('id', id);
  if (error) throw error;
}

export async function deletePipeline(id: string): Promise<void> {
  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Stages
export async function getPipelineStages(pipelineId: string): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('position');
  if (error) throw error;
  return (data || []) as unknown as PipelineStage[];
}

export async function getTenantStages(tenantId: string): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position');
  if (error) throw error;
  return (data || []) as unknown as PipelineStage[];
}

export async function createStage(tenantId: string, pipelineId: string, name: string, position: number, color?: string | null): Promise<PipelineStage> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({ tenant_id: tenantId, pipeline_id: pipelineId, name, position, color: color ?? null } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PipelineStage;
}

export async function updateStage(id: string, updates: { name?: string; position?: number; color?: string | null }): Promise<void> {
  const { error } = await supabase
    .from('pipeline_stages')
    .update(updates as never)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
