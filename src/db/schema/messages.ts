import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { threads } from './threads';
import { profiles } from './profiles';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(),
  senderSubtype: text('sender_subtype'),
  senderUserId: uuid('sender_user_id').references(() => profiles.id),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('idx_messages_tenant_id').on(table.tenantId),
  threadIdx: index('idx_messages_thread_id').on(table.threadId),
  createdAtIdx: index('idx_messages_created_at').on(table.createdAt),
  tenantThreadCreatedIdx: index('idx_messages_tenant_thread_created').on(
    table.tenantId,
    table.threadId,
    table.createdAt
  ),
}));
