import { z } from 'zod';

/** V1 Evolution: one connection per tenant. api_key opcional: vazio = manter o existente. */
export const upsertEvolutionConnectionSchema = z.object({
  name: z.string().trim().min(1).max(80).default('WhatsApp Principal'),
  is_active: z.boolean().default(false),
  base_url: z.string().trim().max(500),
  api_key: z.string().trim().max(500).optional(),
  phone_number: z.string().trim().max(30).nullable().optional(),
  instance_name: z.string().trim().min(1, 'Instance name é obrigatório').max(120),
  webhook_secret: z.string().trim().max(256).nullable().optional(),
});

export const linkThreadSchema = z.object({
  connection_id: z.string().uuid(),
  wa_chat_id: z.string().trim().min(1).max(128),
  wa_contact_phone: z.string().trim().max(32).default(''),
  wa_contact_name: z.string().trim().max(200).nullable().optional(),
  thread_id: z.string().uuid(),
});

export type UpsertEvolutionConnectionInput = z.infer<typeof upsertEvolutionConnectionSchema>;
export type LinkThreadInput = z.infer<typeof linkThreadSchema>;
