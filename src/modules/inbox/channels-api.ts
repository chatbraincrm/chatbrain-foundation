import { supabase } from '@/integrations/supabase/client';
import type { Channel } from '@/types';

export async function getTenantChannels(tenantId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return (data || []) as unknown as Channel[];
}

export async function createChannel(
  tenantId: string,
  type: string,
  name: string
): Promise<Channel> {
  const { data, error } = await supabase
    .from('channels')
    .insert({ tenant_id: tenantId, type, name } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Channel;
}
