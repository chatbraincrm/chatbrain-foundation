import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { appRoleEnum } from './enums';
import { tenants } from './tenants';

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  role: appRoleEnum('role').notNull().default('agent'),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
