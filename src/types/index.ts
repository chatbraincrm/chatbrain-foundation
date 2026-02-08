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

// CRM Types

export interface Pipeline {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  stage_id: string;
  lead_id: string | null;
  company_id: string | null;
  title: string;
  value_cents: number;
  currency: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealWithRelations extends Deal {
  pipeline_stages?: PipelineStage;
  leads?: Pick<Lead, 'id' | 'name' | 'email'> | null;
  companies?: Pick<Company, 'id' | 'name'> | null;
  profiles?: Pick<Profile, 'id' | 'email' | 'name'> | null;
}

export interface Task {
  id: string;
  tenant_id: string;
  deal_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  status: string;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithRelations extends Task {
  profiles?: Pick<Profile, 'id' | 'email' | 'name'> | null;
  deals?: Pick<Deal, 'id' | 'title'> | null;
}

export interface ActivityTimelineEntry {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  entity: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityTimelineWithProfile extends ActivityTimelineEntry {
  profiles: Pick<Profile, 'email' | 'name'> | null;
}

export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityTag {
  id: string;
  tenant_id: string;
  tag_id: string;
  entity: string;
  entity_id: string;
  created_at: string;
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
