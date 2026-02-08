import { pgTable, uuid, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { aiAgents } from './ai-agents';

export const aiAgentSettings = pgTable(
  'ai_agent_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => aiAgents.id, { onDelete: 'cascade' }),
    responseDelayMs: integer('response_delay_ms').notNull().default(1200),
    useChunkedMessages: boolean('use_chunked_messages').notNull().default(true),
    allowAudio: boolean('allow_audio').notNull().default(true),
    allowImages: boolean('allow_images').notNull().default(true),
    allowHandoffHuman: boolean('allow_handoff_human').notNull().default(true),
    allowScheduling: boolean('allow_scheduling').notNull().default(true),
    typingSimulation: boolean('typing_simulation').notNull().default(true),
    maxChunks: integer('max_chunks').notNull().default(6),
    maxConsecutiveReplies: integer('max_consecutive_replies').notNull().default(5),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueAgent: unique().on(table.agentId),
  })
);
