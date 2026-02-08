import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { channels } from './channels';
import { profiles } from './profiles';

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  channelId: uuid('channel_id').notNull().references(() => channels.id),
  subject: text('subject'),
  status: text('status').notNull().default('open'),
  assignedUserId: uuid('assigned_user_id').references(() => profiles.id),
  relatedEntity: text('related_entity'),
  relatedEntityId: uuid('related_entity_id'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('idx_threads_tenant_id').on(table.tenantId),
  channelIdx: index('idx_threads_channel_id').on(table.channelId),
  statusIdx: index('idx_threads_status').on(table.status),
  assignedIdx: index('idx_threads_assigned_user_id').on(table.assignedUserId),
}));
