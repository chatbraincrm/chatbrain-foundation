import { describe, it, expect, vi } from 'vitest';
import { shouldStopChunkedSend } from '@/modules/inbox/run-agent';

describe('shouldStopChunkedSend', () => {
  it('returns true when handed off', () => {
    expect(shouldStopChunkedSend(true, 'open')).toBe(true);
    expect(shouldStopChunkedSend(true, 'closed')).toBe(true);
  });

  it('returns true when thread status is closed', () => {
    expect(shouldStopChunkedSend(false, 'closed')).toBe(true);
    expect(shouldStopChunkedSend(true, 'closed')).toBe(true);
  });

  it('returns false when open and not handed off', () => {
    expect(shouldStopChunkedSend(false, 'open')).toBe(false);
  });
});

const mocks = vi.hoisted(() => ({
  canAgentRespond: vi.fn(),
  insertAiMessage: vi.fn(),
  getThread: vi.fn(),
  getAgent: vi.fn(),
  getThreadHandoff: vi.fn(),
  getThreadMessages: vi.fn(),
  getAgentChannels: vi.fn(),
}));

vi.mock('@/modules/billing/usage-api', () => ({
  canAgentRespond: (...args: unknown[]) => mocks.canAgentRespond(...args),
  incrementAiUsage: vi.fn().mockResolvedValue(undefined),
  incrementMessageUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/modules/inbox/threads-api', () => ({ getThread: (...args: unknown[]) => mocks.getThread(...args) }));
vi.mock('@/modules/inbox/messages-api', () => ({
  getThreadMessages: (...args: unknown[]) => mocks.getThreadMessages(...args),
  insertAiMessage: (...args: unknown[]) => mocks.insertAiMessage(...args),
}));
vi.mock('@/modules/inbox/handoffs-api', () => ({
  getThreadHandoff: (...args: unknown[]) => mocks.getThreadHandoff(...args),
}));
vi.mock('@/modules/ai-agent/ai-agent-api', () => ({
  getAgent: (...args: unknown[]) => mocks.getAgent(...args),
  getAgentChannels: (...args: unknown[]) => mocks.getAgentChannels(...args),
  getAgentSettings: vi.fn().mockResolvedValue({}),
  listKnowledge: vi.fn().mockResolvedValue([]),
  insertAgentActivityLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/modules/whatsapp/whatsapp-api', () => ({ trySendWhatsAppOutbound: vi.fn().mockResolvedValue(undefined) }));

describe('runAiAgentCore agent limit (canAgentRespond)', () => {
  it('does not call insertAiMessage when canAgentRespond returns false', async () => {
    const { runAiAgentCore } = await import('@/modules/inbox/run-agent');
    mocks.canAgentRespond.mockResolvedValue(false);
    mocks.getThread.mockResolvedValue({
      id: 't1',
      status: 'open',
      channels: { type: 'internal', name: 'Internal' },
    });
    mocks.getAgent.mockResolvedValue({ id: 'a1', is_active: true });
    mocks.getThreadHandoff.mockResolvedValue({ is_handed_off: false });
    mocks.getThreadMessages.mockResolvedValue([{ sender_type: 'user', content: 'Oi' }]);
    mocks.getAgentChannels.mockResolvedValue([{ channel_type: 'internal', is_enabled: true }]);

    await runAiAgentCore('tenant-1', 'thread-1', {});

    expect(mocks.canAgentRespond).toHaveBeenCalled();
    expect(mocks.insertAiMessage).not.toHaveBeenCalled();
  });
});
