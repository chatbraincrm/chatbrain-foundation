import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { appRoleEnum } from './enums';
import { tenants } from './tenants';
import { profiles } from './profiles';

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  role: appRoleEnum('role').notNull().default('agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
