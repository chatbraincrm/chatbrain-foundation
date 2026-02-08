import { pgTable, uuid, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { threads } from './threads';
import { profiles } from './profiles';

export const threadHandoffs = pgTable(
  'thread_handoffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    isHandedOff: boolean('is_handed_off').notNull().default(false),
    handedOffAt: timestamp('handed_off_at', { withTimezone: true }),
    handedOffBy: uuid('handed_off_by').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueThread: unique().on(table.threadId),
  })
);
