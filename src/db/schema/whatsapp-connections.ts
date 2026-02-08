import { pgTable, uuid, text, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const whatsappConnections = pgTable(
  'whatsapp_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('evolution'),
    name: text('name').notNull().default('WhatsApp Principal'),
    isActive: boolean('is_active').notNull().default(false),
    baseUrl: text('base_url').notNull().default(''),
    apiKey: text('api_key').notNull().default(''),
    phoneNumber: text('phone_number'),
    instanceName: text('instance_name').notNull().default(''),
    webhookSecret: text('webhook_secret'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTenantId: unique().on(table.tenantId),
    tenantIdx: index('idx_whatsapp_connections_tenant').on(table.tenantId),
  })
);
