export const AI_AGENT_CHANNEL_TYPES = ['internal', 'whatsapp', 'email', 'instagram'] as const;
export type AiAgentChannelType = (typeof AI_AGENT_CHANNEL_TYPES)[number];

export const AI_AGENT_SOURCE_TYPES = ['text', 'link', 'file'] as const;
export type AiAgentSourceType = (typeof AI_AGENT_SOURCE_TYPES)[number];

export interface AiAgent {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  system_prompt: string;
  user_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiAgentChannel {
  id: string;
  tenant_id: string;
  agent_id: string;
  channel_type: AiAgentChannelType;
  is_enabled: boolean;
}

export interface AiAgentSettings {
  id: string;
  tenant_id: string;
  agent_id: string;
  response_delay_ms: number;
  use_chunked_messages: boolean;
  allow_audio: boolean;
  allow_images: boolean;
  allow_handoff_human: boolean;
  allow_scheduling: boolean;
  typing_simulation: boolean;
  max_chunks: number;
  max_consecutive_replies: number;
  updated_at: string;
}

export interface AiAgentKnowledgeItem {
  id: string;
  tenant_id: string;
  agent_id: string;
  title: string;
  content: string | null;
  source_type: AiAgentSourceType;
  source_url: string | null;
  file_path: string | null;
  created_at: string;
}

export type AiAgentUpsertPayload = {
  name: string;
  is_active: boolean;
  system_prompt: string;
  user_prompt?: string | null;
};

export type AiAgentSettingsPayload = {
  response_delay_ms?: number;
  use_chunked_messages?: boolean;
  allow_audio?: boolean;
  allow_images?: boolean;
  allow_handoff_human?: boolean;
  allow_scheduling?: boolean;
  typing_simulation?: boolean;
  max_chunks?: number;
  max_consecutive_replies?: number;
};

export interface AgentActivityLog {
  id: string;
  tenant_id: string;
  thread_id: string;
  channel_type: string;
  responded_at: string;
  interrupted_by_handoff: boolean;
  content_summary: string | null;
  created_at: string;
}

export type AiAgentKnowledgePayload = {
  title: string;
  source_type: AiAgentSourceType;
  content?: string | null;
  source_url?: string | null;
  file_path?: string | null;
};
