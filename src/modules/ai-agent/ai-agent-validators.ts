import { z } from 'zod';
import { AI_AGENT_CHANNEL_TYPES, AI_AGENT_SOURCE_TYPES } from './ai-agent-types';

export const aiAgentSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(80, 'Nome deve ter no máximo 80 caracteres'),
  is_active: z.boolean(),
  system_prompt: z.string().trim().min(20, 'Prompt do sistema deve ter ao menos 20 caracteres').max(12000, 'Máximo 12000 caracteres'),
  user_prompt: z.string().trim().max(12000, 'Máximo 12000 caracteres').nullable().optional(),
});

export const aiAgentSettingsSchema = z.object({
  response_delay_ms: z.number().int().min(0, 'Mínimo 0').max(15000, 'Máximo 15000'),
  use_chunked_messages: z.boolean(),
  typing_simulation: z.boolean(),
  max_chunks: z.number().int().min(1, 'Mínimo 1').max(12, 'Máximo 12'),
  max_consecutive_replies: z.number().int().min(1, 'Mínimo 1').max(20, 'Máximo 20'),
  allow_audio: z.boolean(),
  allow_images: z.boolean(),
  allow_handoff_human: z.boolean(),
  allow_scheduling: z.boolean(),
});

export const aiAgentKnowledgeSchema = z.object({
  title: z.string().trim().min(2, 'Título deve ter ao menos 2 caracteres').max(120, 'Máximo 120 caracteres'),
  source_type: z.enum(AI_AGENT_SOURCE_TYPES),
  content: z.string().trim().max(50000).nullable().optional(),
  source_url: z.string().trim().url('URL inválida').nullable().optional().or(z.literal('')),
  file_path: z.string().trim().max(2000).nullable().optional(),
}).refine(
  (data) => {
    if (data.source_type === 'text') return (data.content?.length ?? 0) > 0;
    if (data.source_type === 'link') return !!(data.source_url?.trim());
    if (data.source_type === 'file') return !!(data.file_path?.trim());
    return true;
  },
  { message: 'Preencha o campo obrigatório para o tipo selecionado', path: ['content'] }
);

export type AiAgentFormData = z.infer<typeof aiAgentSchema>;
export type AiAgentSettingsFormData = z.infer<typeof aiAgentSettingsSchema>;
export type AiAgentKnowledgeFormData = z.infer<typeof aiAgentKnowledgeSchema>;
