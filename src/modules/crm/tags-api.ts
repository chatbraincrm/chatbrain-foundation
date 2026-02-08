import { supabase } from '@/integrations/supabase/client';
import type { Tag, EntityTag } from '@/types';

export async function getTenantTags(tenantId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return (data || []) as unknown as Tag[];
}

export async function createTag(tenantId: string, name: string, color?: string | null): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ tenant_id: tenantId, name, color: color ?? null } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Tag;
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}

export async function getEntityTags(tenantId: string, entity: string, entityId: string): Promise<(EntityTag & { tags: Tag })[]> {
  const { data, error } = await supabase
    .from('entity_tags')
    .select('*, tags(*)')
    .eq('tenant_id', tenantId)
    .eq('entity', entity)
    .eq('entity_id', entityId);
  if (error) throw error;
  return (data || []) as any;
}

export async function getAllEntityTags(tenantId: string, entity: string): Promise<(EntityTag & { tags: Tag })[]> {
  const { data, error } = await supabase
    .from('entity_tags')
    .select('*, tags(*)')
    .eq('tenant_id', tenantId)
    .eq('entity', entity);
  if (error) throw error;
  return (data || []) as any;
}

export async function addEntityTag(tenantId: string, tagId: string, entity: string, entityId: string): Promise<void> {
  const { error } = await supabase
    .from('entity_tags')
    .insert({ tenant_id: tenantId, tag_id: tagId, entity, entity_id: entityId } as never);
  if (error) throw error;
}

export async function removeEntityTag(id: string): Promise<void> {
  const { error } = await supabase.from('entity_tags').delete().eq('id', id);
  if (error) throw error;
}
