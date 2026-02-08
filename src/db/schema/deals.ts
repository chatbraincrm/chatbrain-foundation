import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { pipelines } from './pipelines';
import { pipelineStages } from './pipeline-stages';
import { leads } from './leads';
import { companies } from './companies';
import { profiles } from './profiles';

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  pipelineId: uuid('pipeline_id').notNull().references(() => pipelines.id),
  stageId: uuid('stage_id').notNull().references(() => pipelineStages.id),
  leadId: uuid('lead_id').references(() => leads.id),
  companyId: uuid('company_id').references(() => companies.id),
  title: text('title').notNull(),
  valueCents: integer('value_cents').notNull().default(0),
  currency: text('currency').notNull().default('BRL'),
  ownerUserId: uuid('owner_user_id').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
