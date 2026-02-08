import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { deals } from './deals';
import { leads } from './leads';
import { companies } from './companies';
import { profiles } from './profiles';

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  dealId: uuid('deal_id').references(() => deals.id),
  leadId: uuid('lead_id').references(() => leads.id),
  companyId: uuid('company_id').references(() => companies.id),
  title: text('title').notNull(),
  description: text('description'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  status: text('status').notNull().default('open'),
  assignedUserId: uuid('assigned_user_id').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
