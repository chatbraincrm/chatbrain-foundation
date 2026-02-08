import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type {
  AiAgent,
  AiAgentChannel,
  AiAgentSettings,
  AiAgentKnowledgeItem,
  AiAgentChannelType,
  AiAgentUpsertPayload,
  AiAgentSettingsPayload,
  AiAgentKnowledgePayload,
  AgentActivityLog,
} from './ai-agent-types';

export async function getAgent(
  tenantId: string,
  client?: SupabaseClient
): Promise<AiAgent | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('ai_agents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AiAgent | null;
}

export async function upsertAgent(tenantId: string, payload: AiAgentUpsertPayload): Promise<AiAgent> {
  const existing = await getAgent(tenantId);
  if (existing) {
    const { data, error } = await supabase
      .from('ai_agents')
      .update({
        name: payload.name,
        is_active: payload.is_active,
        system_prompt: payload.system_prompt,
        user_prompt: payload.user_prompt ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as AiAgent;
  }
  const { data, error } = await supabase
    .from('ai_agents')
    .insert({
      tenant_id: tenantId,
      name: payload.name,
      is_active: payload.is_active,
      system_prompt: payload.system_prompt,
      user_prompt: payload.user_prompt ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as AiAgent;
}

export async function getAgentChannels(
  tenantId: string,
  agentId: string,
  client?: SupabaseClient
): Promise<AiAgentChannel[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('ai_agent_channels')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId);
  if (error) throw error;
  return (data || []) as AiAgentChannel[];
}

export async function setChannelEnabled(
  tenantId: string,
  agentId: string,
  channelType: AiAgentChannelType,
  isEnabled: boolean
): Promise<AiAgentChannel> {
  const { data, error } = await supabase
    .from('ai_agent_channels')
    .upsert(
      {
        tenant_id: tenantId,
        agent_id: agentId,
        channel_type: channelType,
        is_enabled: isEnabled,
      } as never,
      { onConflict: 'agent_id,channel_type' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as AiAgentChannel;
}

const DEFAULT_SETTINGS = {
  response_delay_ms: 1200,
  use_chunked_messages: true,
  allow_audio: true,
  allow_images: true,
  allow_handoff_human: true,
  allow_scheduling: true,
  typing_simulation: true,
  max_chunks: 6,
  max_consecutive_replies: 5,
};

export async function getAgentSettings(
  tenantId: string,
  agentId: string,
  client?: SupabaseClient
): Promise<AiAgentSettings | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('ai_agent_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as AiAgentSettings;
  try {
    await db.from('ai_agent_settings').insert({
      tenant_id: tenantId,
      agent_id: agentId,
      ...DEFAULT_SETTINGS,
    } as never);
  } catch {
    // RLS may deny insert for agent; ignore
  }
  const { data: data2, error: err2 } = await db
    .from('ai_agent_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (err2) throw err2;
  return (data2 as AiAgentSettings) ?? null;
}

export async function updateAgentSettings(
  tenantId: string,
  agentId: string,
  payload: AiAgentSettingsPayload
): Promise<AiAgentSettings> {
  const { data, error } = await supabase
    .from('ai_agent_settings')
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .select()
    .single();
  if (error) throw error;
  return data as AiAgentSettings;
}

export async function listKnowledge(
  tenantId: string,
  agentId: string,
  search?: string,
  client?: SupabaseClient
): Promise<AiAgentKnowledgeItem[]> {
  const db = client ?? supabase;
  let q = db
    .from('ai_agent_knowledge')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (search?.trim()) {
    q = q.ilike('title', `%${search.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AiAgentKnowledgeItem[];
}

export async function createKnowledge(
  tenantId: string,
  agentId: string,
  payload: AiAgentKnowledgePayload
): Promise<AiAgentKnowledgeItem> {
  const { data, error } = await supabase
    .from('ai_agent_knowledge')
    .insert({
      tenant_id: tenantId,
      agent_id: agentId,
      title: payload.title,
      source_type: payload.source_type,
      content: payload.content ?? null,
      source_url: payload.source_url ?? null,
      file_path: payload.file_path ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as AiAgentKnowledgeItem;
}

export async function updateKnowledge(
  tenantId: string,
  agentId: string,
  id: string,
  payload: AiAgentKnowledgePayload
): Promise<AiAgentKnowledgeItem> {
  const { data, error } = await supabase
    .from('ai_agent_knowledge')
    .update({
      title: payload.title,
      source_type: payload.source_type,
      content: payload.content ?? null,
      source_url: payload.source_url ?? null,
      file_path: payload.file_path ?? null,
    } as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId)
    .select()
    .single();
  if (error) throw error;
  return data as AiAgentKnowledgeItem;
}

export async function deleteKnowledge(
  tenantId: string,
  agentId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_knowledge')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('agent_id', agentId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Agent activity logs (aba Atividade do Agente)
// ---------------------------------------------------------------------------

export async function getAgentActivityLogs(
  tenantId: string,
  options: { limit?: number; threadId?: string } = {},
  client?: SupabaseClient
): Promise<AgentActivityLog[]> {
  const db = client ?? supabase;
  const limit = Math.min(options.limit ?? 50, 100);
  let q = db
    .from('agent_activity_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('responded_at', { ascending: false })
    .limit(limit);
  if (options.threadId) {
    q = q.eq('thread_id', options.threadId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AgentActivityLog[];
}

export async function insertAgentActivityLog(
  tenantId: string,
  threadId: string,
  channelType: string,
  contentSummary: string | null,
  client?: SupabaseClient
): Promise<AgentActivityLog> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('agent_activity_logs')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      channel_type: channelType,
      content_summary: contentSummary,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as AgentActivityLog;
}

export async function markLatestAgentActivityInterrupted(
  tenantId: string,
  threadId: string,
  client?: SupabaseClient
): Promise<void> {
  const db = client ?? supabase;
  const { data: latest } = await db
    .from('agent_activity_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .order('responded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return;
  await db
    .from('agent_activity_logs')
    .update({ interrupted_by_handoff: true } as never)
    .eq('id', latest.id);
}
