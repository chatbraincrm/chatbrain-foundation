import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { whatsappConnections } from './whatsapp-connections';

export const whatsappContacts = pgTable(
  'whatsapp_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => whatsappConnections.id, { onDelete: 'cascade' }),
    waId: text('wa_id').notNull(),
    name: text('name'),
    phoneE164: text('phone_e164'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTenantConnectionWa: unique().on(table.tenantId, table.connectionId, table.waId),
    tenantConnectionIdx: index('idx_whatsapp_contacts_tenant_connection').on(
      table.tenantId,
      table.connectionId
    ),
    waIdIdx: index('idx_whatsapp_contacts_wa_id').on(table.connectionId, table.waId),
  })
);
