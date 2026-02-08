import { pgTable, uuid, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueTenantTypeName: unique().on(table.tenantId, table.type, table.name),
}));
