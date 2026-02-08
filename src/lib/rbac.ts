import type { AppRole } from '@/types';

export type Permission =
  | 'members:read' | 'members:write' | 'members:delete'
  | 'invites:read' | 'invites:write' | 'invites:delete'
  | 'audit:read'
  | 'tenant:read' | 'tenant:write'
  | 'crm:read' | 'crm:write' | 'crm:delete';

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    'members:read', 'members:write', 'members:delete',
    'invites:read', 'invites:write', 'invites:delete',
    'audit:read',
    'tenant:read', 'tenant:write',
    'crm:read', 'crm:write', 'crm:delete',
  ],
  manager: [
    'members:read',
    'invites:read',
    'audit:read',
    'tenant:read',
    'crm:read', 'crm:write', 'crm:delete',
  ],
  agent: [
    'members:read',
    'tenant:read',
    'crm:read', 'crm:write',
  ],
};

const ROLE_HIERARCHY: AppRole[] = ['admin', 'manager', 'agent'];

export function hasRole(userRole: AppRole | null | undefined, requiredRole: AppRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY.indexOf(userRole) <= ROLE_HIERARCHY.indexOf(requiredRole);
}

export function can(userRole: AppRole | null | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}
