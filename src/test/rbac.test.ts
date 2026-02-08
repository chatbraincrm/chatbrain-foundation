import { describe, it, expect } from 'vitest';
import { hasRole, can } from '@/lib/rbac';

describe('hasRole', () => {
  it('returns false for null role', () => {
    expect(hasRole(null, 'admin')).toBe(false);
  });

  it('returns false for undefined role', () => {
    expect(hasRole(undefined, 'admin')).toBe(false);
  });

  it('admin has admin role', () => {
    expect(hasRole('admin', 'admin')).toBe(true);
  });

  it('admin has manager role (hierarchy)', () => {
    expect(hasRole('admin', 'manager')).toBe(true);
  });

  it('admin has agent role (hierarchy)', () => {
    expect(hasRole('admin', 'agent')).toBe(true);
  });

  it('manager does not have admin role', () => {
    expect(hasRole('manager', 'admin')).toBe(false);
  });

  it('manager has manager role', () => {
    expect(hasRole('manager', 'manager')).toBe(true);
  });

  it('manager has agent role', () => {
    expect(hasRole('manager', 'agent')).toBe(true);
  });

  it('agent has only agent role', () => {
    expect(hasRole('agent', 'agent')).toBe(true);
    expect(hasRole('agent', 'manager')).toBe(false);
    expect(hasRole('agent', 'admin')).toBe(false);
  });
});

describe('can', () => {
  it('returns false for null role', () => {
    expect(can(null, 'members:read')).toBe(false);
  });

  it('admin can do everything', () => {
    expect(can('admin', 'members:read')).toBe(true);
    expect(can('admin', 'members:write')).toBe(true);
    expect(can('admin', 'members:delete')).toBe(true);
    expect(can('admin', 'invites:read')).toBe(true);
    expect(can('admin', 'invites:write')).toBe(true);
    expect(can('admin', 'audit:read')).toBe(true);
    expect(can('admin', 'tenant:read')).toBe(true);
    expect(can('admin', 'tenant:write')).toBe(true);
    expect(can('admin', 'crm:read')).toBe(true);
    expect(can('admin', 'crm:write')).toBe(true);
    expect(can('admin', 'crm:delete')).toBe(true);
  });

  it('manager can read but not write members', () => {
    expect(can('manager', 'members:read')).toBe(true);
    expect(can('manager', 'members:write')).toBe(false);
    expect(can('manager', 'members:delete')).toBe(false);
  });

  it('manager can read audit and invites', () => {
    expect(can('manager', 'audit:read')).toBe(true);
    expect(can('manager', 'invites:read')).toBe(true);
    expect(can('manager', 'invites:write')).toBe(false);
  });

  it('manager has full CRM access', () => {
    expect(can('manager', 'crm:read')).toBe(true);
    expect(can('manager', 'crm:write')).toBe(true);
    expect(can('manager', 'crm:delete')).toBe(true);
  });

  it('agent has minimal permissions', () => {
    expect(can('agent', 'members:read')).toBe(true);
    expect(can('agent', 'tenant:read')).toBe(true);
    expect(can('agent', 'members:write')).toBe(false);
    expect(can('agent', 'audit:read')).toBe(false);
    expect(can('agent', 'invites:read')).toBe(false);
  });

  it('agent can read and write CRM but not delete', () => {
    expect(can('agent', 'crm:read')).toBe(true);
    expect(can('agent', 'crm:write')).toBe(true);
    expect(can('agent', 'crm:delete')).toBe(false);
  });

  it('admin and manager have view and manage AI agent', () => {
    expect(can('admin', 'view_ai_agent')).toBe(true);
    expect(can('admin', 'manage_ai_agent')).toBe(true);
    expect(can('manager', 'view_ai_agent')).toBe(true);
    expect(can('manager', 'manage_ai_agent')).toBe(true);
  });

  it('agent has only view AI agent', () => {
    expect(can('agent', 'view_ai_agent')).toBe(true);
    expect(can('agent', 'manage_ai_agent')).toBe(false);
  });

  it('admin and manager have view and manage WhatsApp settings', () => {
    expect(can('admin', 'view_whatsapp_settings')).toBe(true);
    expect(can('admin', 'manage_whatsapp_settings')).toBe(true);
    expect(can('manager', 'view_whatsapp_settings')).toBe(true);
    expect(can('manager', 'manage_whatsapp_settings')).toBe(true);
  });

  it('agent has only view WhatsApp settings', () => {
    expect(can('agent', 'view_whatsapp_settings')).toBe(true);
    expect(can('agent', 'manage_whatsapp_settings')).toBe(false);
  });
});
