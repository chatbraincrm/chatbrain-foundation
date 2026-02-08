import type { AiAgent, AiAgentSettings, AiAgentKnowledgeItem } from '../ai-agent-types';
import type { AiProvider } from './ai-provider';

const MAX_KNOWLEDGE_ITEMS = 12;
const MAX_KNOWLEDGE_CHARS = 2000;
const MAX_MESSAGES_CONTEXT = 20;

export interface ShouldAgentRespondParams {
  threadStatus: string;
  channelType: string;
  agentActive: boolean;
  internalChannelEnabled: boolean;
  /** When channel is whatsapp, agent responds only if this is true (ai_agent_channels whatsapp enabled). */
  whatsappChannelEnabled?: boolean;
  isHandedOff: boolean;
  lastMessageFromAgent: boolean;
}

export function shouldAgentRespond(params: ShouldAgentRespondParams): boolean {
  if (params.threadStatus !== 'open') return false;
  if (!params.agentActive) return false;
  if (params.isHandedOff) return false;
  if (params.lastMessageFromAgent) return false;

  const channelAllowed =
    (params.channelType === 'internal' && params.internalChannelEnabled) ||
    (params.channelType === 'whatsapp' && (params.whatsappChannelEnabled === true));
  if (!channelAllowed) return false;

  return true;
}

export interface AgentContext {
  agent: AiAgent;
  settings: AiAgentSettings | null;
  knowledge: AiAgentKnowledgeItem[];
  messages: { sender_type: string; sender_subtype?: string | null; content: string }[];
}

/**
 * Truncates knowledge to at most MAX_KNOWLEDGE_ITEMS and MAX_KNOWLEDGE_CHARS total.
 * Truncates conversation to at most MAX_MESSAGES_CONTEXT (oldest dropped).
 * Adds instruction to respond in short separate messages (max maxChunks).
 */
export function buildPrompt(context: AgentContext): {
  systemPrompt: string;
  userPrompt: string | null;
  conversation: { role: 'user' | 'assistant'; content: string }[];
} {
  let systemPrompt = context.agent.system_prompt;

  const maxChunks = context.settings?.max_chunks ?? 6;
  const chunkInstruction = `\n\nResponda em mensagens curtas e separadas quando fizer sentido, usando no máximo ${maxChunks} fragmentos de texto. Evite blocos únicos muito longos.`;

  const knowledgeLimited = context.knowledge.slice(0, MAX_KNOWLEDGE_ITEMS);
  let knowledgeChars = 0;
  const knowledgeParts: string[] = [];
  for (const k of knowledgeLimited) {
    const part = k.content
      ? `## ${k.title}\n${k.content}`
      : k.source_url
        ? `## ${k.title}\nURL: ${k.source_url}`
        : `## ${k.title}`;
    const partLen = part.length;
    if (knowledgeChars + partLen > MAX_KNOWLEDGE_CHARS) {
      const remaining = MAX_KNOWLEDGE_CHARS - knowledgeChars;
      if (remaining > 20) {
        knowledgeParts.push(part.slice(0, remaining) + '…');
      }
      knowledgeChars = MAX_KNOWLEDGE_CHARS;
      break;
    }
    knowledgeParts.push(part);
    knowledgeChars += partLen;
  }

  if (knowledgeParts.length > 0) {
    systemPrompt += `\n\n--- Base de Conhecimento ---\n${knowledgeParts.join('\n\n')}\n---`;
  }

  systemPrompt += chunkInstruction;

  const userPrompt = context.agent.user_prompt?.trim() || null;

  const conversation = context.messages
    .slice(-MAX_MESSAGES_CONTEXT)
    .filter((m) => m.content?.trim())
    .map((m) => {
      const isAgent = m.sender_type === 'system' && m.sender_subtype === 'ai';
      return {
        role: (isAgent ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content.trim(),
      };
    });

  return { systemPrompt, userPrompt, conversation };
}

export async function generateAgentReply(
  context: AgentContext,
  provider: AiProvider
): Promise<string> {
  const { systemPrompt, userPrompt, conversation } = buildPrompt(context);
  return provider.generateResponse({
    systemPrompt,
    userPrompt,
    conversation,
  });
}

/**
 * Splits text into short chunks (5–160 chars when possible), respecting maxChunks.
 * Prefers splitting on newlines, then on sentence boundaries, then on spaces.
 */
export function chunkReply(text: string, maxChunks: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const MIN_CHUNK = 5;
  const MAX_CHUNK = 160;

  const chunks: string[] = [];

  const parts = trimmed.split(/\n\n+/).flatMap((p) => p.split(/\n/)).filter(Boolean);
  const tokens: string[] = [];
  for (const p of parts) {
    const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      tokens.push(...sentences);
    } else if (p.length > MAX_CHUNK) {
      const bySpace = p.split(/\s+/);
      let current = '';
      for (const w of bySpace) {
        if (current.length + w.length + 1 <= MAX_CHUNK) {
          current = current ? `${current} ${w}` : w;
        } else {
          if (current) tokens.push(current);
          current = w.length > MAX_CHUNK ? w.slice(0, MAX_CHUNK) : w;
        }
      }
      if (current) tokens.push(current);
    } else {
      tokens.push(p);
    }
  }

  let current = '';
  for (const t of tokens) {
    if (chunks.length >= maxChunks) break;
    const candidate = current ? `${current} ${t}` : t;
    if (candidate.length <= MAX_CHUNK && chunks.length < maxChunks - 1) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
        current = '';
      }
      if (t.length <= MAX_CHUNK) {
        current = t;
      } else {
        let rest = t;
        while (rest && chunks.length < maxChunks) {
          const piece = rest.length <= MAX_CHUNK ? rest : rest.slice(0, MAX_CHUNK);
          if (piece.length >= MIN_CHUNK || !rest.slice(MAX_CHUNK)) {
            chunks.push(piece);
            rest = rest.length <= MAX_CHUNK ? '' : rest.slice(MAX_CHUNK);
          } else {
            chunks.push(rest);
            rest = '';
          }
        }
      }
    }
  }
  if (current && chunks.length < maxChunks) {
    chunks.push(current);
  }

  return chunks.slice(0, maxChunks).filter((c) => c.trim().length > 0);
}
