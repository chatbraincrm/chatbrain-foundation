import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

import { sendInviteEmail } from '@/modules/invites/api';

describe('sendInviteEmail (invites api)', () => {
  it('returns sent: false when not authenticated', async () => {
    const result = await sendInviteEmail('any-invite-id');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('Não autenticado');
  });
});
