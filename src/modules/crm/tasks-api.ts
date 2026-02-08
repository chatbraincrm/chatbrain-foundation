import { supabase } from '@/lib/supabase';
import type { Task, TaskWithRelations } from '@/types';

export async function getTenantTasks(tenantId: string, filters?: { deal_id?: string; status?: string }): Promise<TaskWithRelations[]> {
  let query = supabase
    .from('tasks')
    .select('*, profiles:assigned_user_id(id, email, name), deals(id, title)')
    .eq('tenant_id', tenantId)
    .order('due_at', { ascending: true, nullsFirst: false });
  if (filters?.deal_id) query = query.eq('deal_id', filters.deal_id);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as TaskWithRelations[];
}

export async function createTask(tenantId: string, input: {
  title: string;
  description?: string | null;
  due_at?: string | null;
  deal_id?: string | null;
  lead_id?: string | null;
  company_id?: string | null;
  assigned_user_id?: string | null;
}): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      tenant_id: tenantId,
      title: input.title,
      description: input.description || null,
      due_at: input.due_at || null,
      deal_id: input.deal_id || null,
      lead_id: input.lead_id || null,
      company_id: input.company_id || null,
      assigned_user_id: input.assigned_user_id || null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}

export async function updateTask(id: string, input: Partial<{
  title: string;
  description: string | null;
  due_at: string | null;
  status: string;
  assigned_user_id: string | null;
}>): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update(input as never)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
