import { describe, it, expect } from 'vitest';
import { can } from '@/lib/rbac';

describe('Inbox RBAC', () => {
  describe('agent permissions for inbox', () => {
    it('agent can read inbox (crm:read)', () => {
      expect(can('agent', 'crm:read')).toBe(true);
    });

    it('agent can write to inbox (crm:write) — create thread, send message', () => {
      expect(can('agent', 'crm:write')).toBe(true);
    });

    it('agent cannot delete messages (crm:delete)', () => {
      expect(can('agent', 'crm:delete')).toBe(false);
    });
  });

  describe('manager permissions for inbox', () => {
    it('manager can read inbox', () => {
      expect(can('manager', 'crm:read')).toBe(true);
    });

    it('manager can write to inbox', () => {
      expect(can('manager', 'crm:write')).toBe(true);
    });

    it('manager can delete messages', () => {
      expect(can('manager', 'crm:delete')).toBe(true);
    });
  });

  describe('admin permissions for inbox', () => {
    it('admin has full inbox access', () => {
      expect(can('admin', 'crm:read')).toBe(true);
      expect(can('admin', 'crm:write')).toBe(true);
      expect(can('admin', 'crm:delete')).toBe(true);
    });
  });
});
