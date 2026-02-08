import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { profiles } from './profiles';

export const activityTimeline = pgTable('activity_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  actorUserId: uuid('actor_user_id').references(() => profiles.id),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
