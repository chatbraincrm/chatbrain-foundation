import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  getUsageForCurrentPeriod,
  canSendMessage,
  canCreateThread,
  canAgentRespond,
  incrementMessageUsage,
  incrementThreadUsage,
} from '@/modules/billing/usage-api';

describe('usage-api', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  describe('getUsageForCurrentPeriod', () => {
    it('returns zeros when no usage row exists', async () => {
      const usage = await getUsageForCurrentPeriod(tenantId);
      expect(usage).toEqual({
        messages_count: 0,
        ai_messages_count: 0,
        threads_count: 0,
      });
    });

    it('returns usage when row exists', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            messages_count: 100,
            ai_messages_count: 50,
            threads_count: 10,
          },
          error: null,
        }),
      });
      const usage = await getUsageForCurrentPeriod(tenantId);
      expect(usage).toEqual({
        messages_count: 100,
        ai_messages_count: 50,
        threads_count: 10,
      });
    });
  });

  describe('canSendMessage', () => {
    it('returns true when messages below limit', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { messages_count: 100, ai_messages_count: 0, threads_count: 0 },
          error: null,
        }),
      });
      expect(await canSendMessage(tenantId)).toBe(true);
    });

    it('returns false when messages at limit', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { messages_count: 6000, ai_messages_count: 0, threads_count: 0 },
          error: null,
        }),
      });
      expect(await canSendMessage(tenantId)).toBe(false);
    });
  });

  describe('canCreateThread', () => {
    it('returns false when threads at limit', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { messages_count: 0, ai_messages_count: 0, threads_count: 300 },
          error: null,
        }),
      });
      expect(await canCreateThread(tenantId)).toBe(false);
    });

    it('returns true when threads below limit', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { messages_count: 0, ai_messages_count: 0, threads_count: 10 },
          error: null,
        }),
      });
      expect(await canCreateThread(tenantId)).toBe(true);
    });
  });

  describe('canAgentRespond', () => {
    it('returns false when ai_messages_count at limit', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { messages_count: 0, ai_messages_count: 2000, threads_count: 0 },
          error: null,
        }),
      });
      expect(await canAgentRespond(tenantId)).toBe(false);
    });

    it('returns true when ai_messages_count below limit', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { messages_count: 0, ai_messages_count: 100, threads_count: 0 },
          error: null,
        }),
      });
      expect(await canAgentRespond(tenantId)).toBe(true);
    });
  });

  describe('incrementMessageUsage', () => {
    it('calls rpc with messages_delta 1', async () => {
      mockRpc.mockResolvedValue({ error: null });
      await incrementMessageUsage(tenantId);
      expect(mockRpc).toHaveBeenCalledWith(
        'increment_usage_counters',
        expect.objectContaining({
          _messages_delta: 1,
          _ai_messages_delta: 0,
          _threads_delta: 0,
        })
      );
    });
  });

  describe('incrementThreadUsage', () => {
    it('calls rpc with threads_delta 1', async () => {
      mockRpc.mockResolvedValue({ error: null });
      await incrementThreadUsage(tenantId);
      expect(mockRpc).toHaveBeenCalledWith(
        'increment_usage_counters',
        expect.objectContaining({
          _messages_delta: 0,
          _ai_messages_delta: 0,
          _threads_delta: 1,
        })
      );
    });
  });
});
