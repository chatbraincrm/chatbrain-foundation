import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { whatsappConnections } from './whatsapp-connections';
import { threads } from './threads';

export const whatsappThreadLinks = pgTable(
  'whatsapp_thread_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => whatsappConnections.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    waChatId: text('wa_chat_id').notNull(),
    waContactPhone: text('wa_contact_phone').notNull().default(''),
    waContactName: text('wa_contact_name'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTenantConnectionWaChat: unique().on(table.tenantId, table.connectionId, table.waChatId),
    tenantConnectionWaChatIdx: index('idx_whatsapp_thread_links_wa_chat').on(
      table.tenantId,
      table.connectionId,
      table.waChatId
    ),
    tenantThreadIdx: index('idx_whatsapp_thread_links_tenant_thread').on(table.tenantId, table.threadId),
  })
);
