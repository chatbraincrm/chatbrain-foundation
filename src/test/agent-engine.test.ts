import { describe, it, expect } from 'vitest';
import {
  shouldAgentRespond,
  buildPrompt,
  chunkReply,
  type ShouldAgentRespondParams,
  type AgentContext,
} from '@/modules/ai-agent/runtime/agent-engine';

describe('shouldAgentRespond', () => {
  const base: ShouldAgentRespondParams = {
    threadStatus: 'open',
    channelType: 'internal',
    agentActive: true,
    internalChannelEnabled: true,
    isHandedOff: false,
    lastMessageFromAgent: false,
  };

  it('returns true when all conditions pass', () => {
    expect(shouldAgentRespond(base)).toBe(true);
  });

  it('returns false when handed off', () => {
    expect(shouldAgentRespond({ ...base, isHandedOff: true })).toBe(false);
  });

  it('returns false when thread not open', () => {
    expect(shouldAgentRespond({ ...base, threadStatus: 'closed' })).toBe(false);
  });

  it('returns false when channel whatsapp but whatsapp not enabled', () => {
    expect(shouldAgentRespond({ ...base, channelType: 'whatsapp', whatsappChannelEnabled: false })).toBe(false);
    expect(shouldAgentRespond({ ...base, channelType: 'whatsapp' })).toBe(false);
  });

  it('returns true when channel whatsapp and whatsapp enabled', () => {
    expect(
      shouldAgentRespond({
        ...base,
        channelType: 'whatsapp',
        internalChannelEnabled: false,
        whatsappChannelEnabled: true,
      })
    ).toBe(true);
  });

  it('returns false when agent inactive', () => {
    expect(shouldAgentRespond({ ...base, agentActive: false })).toBe(false);
  });

  it('returns false when internal channel not enabled', () => {
    expect(shouldAgentRespond({ ...base, internalChannelEnabled: false })).toBe(false);
  });

  it('returns false when last message is from agent', () => {
    expect(shouldAgentRespond({ ...base, lastMessageFromAgent: true })).toBe(false);
  });
});

describe('buildPrompt', () => {
  it('includes knowledge in system prompt', () => {
    const context: AgentContext = {
      agent: {
        id: 'a1',
        tenant_id: 't1',
        name: 'Test',
        is_active: true,
        system_prompt: 'You are helpful.',
        user_prompt: null,
        created_at: '',
        updated_at: '',
      },
      settings: null,
      knowledge: [
        {
          id: 'k1',
          tenant_id: 't1',
          agent_id: 'a1',
          title: 'FAQ',
          content: 'Q: X? A: Y.',
          source_type: 'text',
          source_url: null,
          file_path: null,
          created_at: '',
        },
      ],
      messages: [{ sender_type: 'user', content: 'Hi' }],
    };
    const { systemPrompt, conversation } = buildPrompt(context);
    expect(systemPrompt).toContain('You are helpful.');
    expect(systemPrompt).toContain('Base de Conhecimento');
    expect(systemPrompt).toContain('FAQ');
    expect(systemPrompt).toContain('Q: X? A: Y.');
    expect(conversation).toHaveLength(1);
    expect(conversation[0].role).toBe('user');
    expect(conversation[0].content).toBe('Hi');
  });

  it('maps system+ai messages to assistant role', () => {
    const context: AgentContext = {
      agent: {
        id: 'a1',
        tenant_id: 't1',
        name: 'Test',
        is_active: true,
        system_prompt: 'Help.',
        user_prompt: null,
        created_at: '',
        updated_at: '',
      },
      settings: null,
      knowledge: [],
      messages: [
        { sender_type: 'user', content: 'Hi' },
        { sender_type: 'system', sender_subtype: 'ai', content: 'Hello!' },
      ],
    };
    const { conversation } = buildPrompt(context);
    expect(conversation).toHaveLength(2);
    expect(conversation[0].role).toBe('user');
    expect(conversation[0].content).toBe('Hi');
    expect(conversation[1].role).toBe('assistant');
    expect(conversation[1].content).toBe('Hello!');
  });
});

describe('chunkReply', () => {
  it('respects maxChunks', () => {
    const long =
      'First sentence. Second sentence. Third sentence. Fourth. Fifth. Sixth. Seventh. Eighth.';
    const chunks = chunkReply(long, 3);
    expect(chunks.length).toBeLessThanOrEqual(3);
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });

  it('does not return empty chunks', () => {
    const chunks = chunkReply('Hello world. How are you?', 10);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(chunkReply('', 5)).toEqual([]);
    expect(chunkReply('   ', 5)).toEqual([]);
  });

  it('splits by newlines first', () => {
    const text = 'Line one\nLine two\nLine three';
    const chunks = chunkReply(text, 5);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join(' ')).toContain('Line one');
    expect(chunks.join(' ')).toContain('Line two');
  });

  it('returns at most maxChunks chunks', () => {
    const long = 'A. '.repeat(200);
    expect(chunkReply(long, 5).length).toBeLessThanOrEqual(5);
    expect(chunkReply(long, 1).length).toBeLessThanOrEqual(1);
    expect(chunkReply('Short.', 10).length).toBeLessThanOrEqual(10);
  });
});

describe('buildPrompt truncation', () => {
  it('limits knowledge to 12 items and 2000 chars total', () => {
    const knowledge = Array.from({ length: 20 }, (_, i) => ({
      id: `k${i}`,
      tenant_id: 't1',
      agent_id: 'a1',
      title: `Item ${i}`,
      content: 'x'.repeat(200),
      source_type: 'text' as const,
      source_url: null,
      file_path: null,
      created_at: '',
    }));
    const context: AgentContext = {
      agent: {
        id: 'a1',
        tenant_id: 't1',
        name: 'Test',
        is_active: true,
        system_prompt: 'Help.',
        user_prompt: null,
        created_at: '',
        updated_at: '',
      },
      settings: { max_chunks: 6 } as AgentContext['settings'],
      knowledge,
      messages: [{ sender_type: 'user', content: 'Hi' }],
    };
    const { systemPrompt } = buildPrompt(context);
    expect(systemPrompt).toContain('Base de Conhecimento');
    expect(systemPrompt).toContain('Item 0');
    expect(systemPrompt.length).toBeLessThanOrEqual(8000);
    const knowledgeBlock = systemPrompt.split('--- Base de Conhecimento ---')[1]?.split('---')[0] ?? '';
    expect(knowledgeBlock.length).toBeLessThanOrEqual(2500);
  });

  it('limits conversation to 20 messages', () => {
    const messages = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0
        ? { sender_type: 'user' as const, content: `User ${i}` }
        : { sender_type: 'system' as const, sender_subtype: 'ai' as const, content: `Agent ${i}` }
    );
    const context: AgentContext = {
      agent: {
        id: 'a1',
        tenant_id: 't1',
        name: 'Test',
        is_active: true,
        system_prompt: 'Help.',
        user_prompt: null,
        created_at: '',
        updated_at: '',
      },
      settings: null,
      knowledge: [],
      messages,
    };
    const { conversation } = buildPrompt(context);
    expect(conversation.length).toBeLessThanOrEqual(20);
    expect(conversation[0]?.content).toContain('User 10');
  });
});
