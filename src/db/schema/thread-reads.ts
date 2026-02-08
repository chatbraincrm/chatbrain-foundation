import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { threads } from './threads';
import { profiles } from './profiles';

export const threadReads = pgTable('thread_reads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueThreadUser: unique().on(table.threadId, table.userId),
}));
