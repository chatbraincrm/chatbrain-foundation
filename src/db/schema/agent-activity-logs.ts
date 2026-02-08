import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { threads } from './threads';

export const agentActivityLogs = pgTable(
  'agent_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    channelType: text('channel_type').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }).notNull().defaultNow(),
    interruptedByHandoff: boolean('interrupted_by_handoff').notNull().default(false),
    contentSummary: text('content_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantRespondedIdx: index('idx_agent_activity_logs_tenant_responded').on(
      table.tenantId,
      table.respondedAt
    ),
    threadIdx: index('idx_agent_activity_logs_thread').on(table.threadId),
  })
);
