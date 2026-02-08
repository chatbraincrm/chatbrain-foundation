import type { SupabaseClient } from '@supabase/supabase-js';
import { getThread } from './threads-api';
import { getThreadMessages, insertAiMessage } from './messages-api';
import { getThreadHandoff } from './handoffs-api';
import { getAgent, getAgentChannels, getAgentSettings, listKnowledge, insertAgentActivityLog } from '@/modules/ai-agent/ai-agent-api';
import { trySendWhatsAppOutbound } from '@/modules/whatsapp/whatsapp-api';
import { shouldAgentRespond, buildPrompt, generateAgentReply, chunkReply, type AgentContext } from '@/modules/ai-agent/runtime/agent-engine';
import { OpenAiProvider, MissingAiKeyError } from '@/modules/ai-agent/runtime/ai-provider';
import { openAiApiKey } from '@/lib/env';
import { canAgentRespond, incrementAiUsage, incrementMessageUsage } from '@/modules/billing/usage-api';

const agentRunningByThread = new Map<string, boolean>();
const lastRunAtByThread = new Map<string, number>();
const COOLDOWN_MS = 10_000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Used during chunked send to decide whether to stop sending more chunks. */
export function shouldStopChunkedSend(isHandedOff: boolean, threadStatus: string): boolean {
  return isHandedOff || threadStatus === 'closed';
}

function typingDelayMs(chunkLength: number, typingSimulation: boolean): number {
  if (!typingSimulation) return 0;
  return Math.min(1200, Math.max(250, Math.floor(chunkLength * 8)));
}

export interface RunAgentDeps {
  supabase?: SupabaseClient;
  /** When provided (e.g. webhook server), used instead of openAiApiKey from env. */
  getOpenAiKey?: () => string | null;
}

/**
 * Core agent run: checks conditions, generates reply, sends chunked messages to Inbox.
 * When thread is WhatsApp and outbound is enabled, also sends each chunk via provider.
 * Use maybeRunAiAgent from the frontend (adds lock + cooldown). Use runAiAgentAfterInbound from webhook (same client).
 */
export async function runAiAgentCore(
  tenantId: string,
  threadId: string,
  deps: RunAgentDeps = {}
): Promise<void> {
  const db = deps.supabase;
  const getKey = deps.getOpenAiKey;

  const [thread, agent, handoff, messages] = await Promise.all([
    getThread(threadId, db),
    getAgent(tenantId, db),
    getThreadHandoff(tenantId, threadId, db),
    getThreadMessages(threadId, db),
  ]);

  if (!thread || !agent) return;
  const channelType = thread.channels?.type ?? '';
  const channels = await getAgentChannels(tenantId, agent.id, db);
  const internalEnabled = channels.some((c) => c.channel_type === 'internal' && c.is_enabled);
  const whatsappEnabled = channels.some((c) => c.channel_type === 'whatsapp' && c.is_enabled);
  const isHandedOff = handoff?.is_handed_off ?? false;
  const lastMsg = messages[messages.length - 1];
  const lastMessageFromAgent =
    !!lastMsg &&
    lastMsg.sender_type === 'system' &&
    (lastMsg as { sender_subtype?: string | null }).sender_subtype === 'ai';

  if (
    !shouldAgentRespond({
      threadStatus: thread.status,
      channelType,
      agentActive: agent.is_active,
      internalChannelEnabled: internalEnabled,
      whatsappChannelEnabled: whatsappEnabled,
      isHandedOff,
      lastMessageFromAgent,
    })
  ) {
    return;
  }

  const canRespond = await canAgentRespond(tenantId, db);
  if (!canRespond) return;

  const apiKey = getKey ? getKey() : openAiApiKey;
  if (!apiKey?.trim()) return;

  const settings = await getAgentSettings(tenantId, agent.id, db);
  const knowledge = await listKnowledge(tenantId, agent.id, undefined, db);

  const maxConsecutive = settings?.max_consecutive_replies ?? 5;
  let consecutiveAi = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { sender_type?: string; sender_subtype?: string | null };
    if (m.sender_type === 'system' && m.sender_subtype === 'ai') {
      consecutiveAi++;
    } else {
      break;
    }
  }
  if (consecutiveAi >= maxConsecutive) {
    return;
  }

  const lastUserContent = lastMsg?.content?.trim() ?? '';
  const isPlaceholderMedia =
    lastUserContent === '[audio] arquivo enviado' || lastUserContent === '[image] arquivo enviado';

  let fullReply: string;
  if (isPlaceholderMedia) {
    fullReply =
      'No momento só consigo processar texto. Por favor, descreva em texto o conteúdo do áudio ou da imagem para que eu possa ajudar.';
  } else {
    const context: AgentContext = {
      agent,
      settings,
      knowledge,
      messages: messages.map((m) => ({
        sender_type: m.sender_type,
        sender_subtype: (m as { sender_subtype?: string | null }).sender_subtype,
        content: m.content,
      })),
    };

    const provider = new OpenAiProvider(apiKey);
    try {
      fullReply = await generateAgentReply(context, provider);
    } catch (err) {
      if (err instanceof MissingAiKeyError) return;
      throw err;
    }
  }

  if (!fullReply?.trim()) return;

  const useChunked = settings?.use_chunked_messages ?? true;
  const maxChunks = settings?.max_chunks ?? 6;
  const responseDelayMs = settings?.response_delay_ms ?? 1200;
  const typingSim = settings?.typing_simulation ?? true;

  const chunks = useChunked ? chunkReply(fullReply, maxChunks) : [fullReply];

  console.info('[runAiAgentCore]', {
    tenantId,
    threadId,
    agentId: agent.id,
    chunks: chunks.length,
    delayMs: responseDelayMs,
    handoff: isHandedOff,
    status: thread.status,
  });

  if (useChunked && chunks.length > 1) {
    for (let i = 0; i < chunks.length; i++) {
      const [handoffNow, threadNow] = await Promise.all([
        getThreadHandoff(tenantId, threadId, db),
        getThread(threadId, db),
      ]);
      if (shouldStopChunkedSend(handoffNow?.is_handed_off ?? false, threadNow?.status ?? '')) {
        break;
      }
      const baseDelay = i === 0 ? responseDelayMs : 0;
      const extra = typingDelayMs(chunks[i].length, typingSim);
      await delay(baseDelay + extra);
      const [handoffBeforeInsert, threadBeforeInsert] = await Promise.all([
        getThreadHandoff(tenantId, threadId, db),
        getThread(threadId, db),
      ]);
      if (shouldStopChunkedSend(handoffBeforeInsert?.is_handed_off ?? false, threadBeforeInsert?.status ?? '')) {
        break;
      }
      await insertAiMessage(tenantId, threadId, chunks[i], db);
      await incrementAiUsage(tenantId, db);
      await incrementMessageUsage(tenantId, db);
      await trySendWhatsAppOutbound(tenantId, threadId, chunks[i], db);
    }
  } else {
    await delay(responseDelayMs);
    await insertAiMessage(tenantId, threadId, fullReply, db);
    await incrementAiUsage(tenantId, db);
    await incrementMessageUsage(tenantId, db);
    await trySendWhatsAppOutbound(tenantId, threadId, fullReply, db);
  }

  const summary = fullReply.length > 50 ? `${fullReply.slice(0, 47).trim()}…` : fullReply;
  insertAgentActivityLog(tenantId, threadId, channelType, summary, db).catch(() => {});
}

/**
 * Runs the AI agent for a thread after a user message, if conditions are met.
 * Only call from the local send-message flow (e.g. sendMutation.onSuccess). Do not call from realtime listeners.
 * Uses in-memory lock and 10s cooldown per thread to avoid loops and duplicate runs.
 */
export async function maybeRunAiAgent(tenantId: string, threadId: string): Promise<void> {
  const now = Date.now();
  if (agentRunningByThread.get(threadId)) return;
  if ((lastRunAtByThread.get(threadId) ?? 0) + COOLDOWN_MS > now) return;

  agentRunningByThread.set(threadId, true);
  lastRunAtByThread.set(threadId, now);

  try {
    await runAiAgentCore(tenantId, threadId, {});
  } finally {
    agentRunningByThread.delete(threadId);
  }
}

/**
 * Call from webhook receiver after inserting inbound WhatsApp message.
 * Uses the provided Supabase client (e.g. service role). Optional getOpenAiKey for server env (e.g. process.env.OPENAI_API_KEY).
 */
export async function runAiAgentAfterInbound(
  tenantId: string,
  threadId: string,
  supabaseClient: SupabaseClient,
  getOpenAiKey?: () => string | null
): Promise<void> {
  await runAiAgentCore(tenantId, threadId, {
    supabase: supabaseClient,
    getOpenAiKey,
  });
}
