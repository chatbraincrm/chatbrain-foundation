export type AppRole = 'admin' | 'manager' | 'agent';

export interface Profile {
  id: string;
  email: string;
  name: string;
  active_tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface MembershipWithProfile extends Membership {
  profiles: Profile;
}

export interface Invite {
  id: string;
  tenant_id: string;
  email: string;
  role: AppRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogWithProfile extends AuditLog {
  profiles: Pick<Profile, 'email' | 'name'> | null;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
