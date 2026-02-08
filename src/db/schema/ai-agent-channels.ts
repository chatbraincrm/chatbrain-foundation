import { pgTable, uuid, text, boolean, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { aiAgents } from './ai-agents';

export const aiAgentChannels = pgTable(
  'ai_agent_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => aiAgents.id, { onDelete: 'cascade' }),
    channelType: text('channel_type').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
  },
  (table) => ({
    uniqueAgentChannelType: unique().on(table.agentId, table.channelType),
  })
);
