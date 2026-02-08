import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { aiAgents } from './ai-agents';

export const aiAgentKnowledge = pgTable('ai_agent_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => aiAgents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  sourceType: text('source_type').notNull(),
  sourceUrl: text('source_url'),
  filePath: text('file_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
