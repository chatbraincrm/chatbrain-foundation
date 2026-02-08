import { z } from 'zod';

// Auth validators
export const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});

export const signupSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
});

export const createTenantSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  slug: z.string().trim().min(1, 'Slug é obrigatório').max(50, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
});

export const createInviteSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  role: z.enum(['admin', 'manager', 'agent']),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Email inválido'),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
});

// CRM validators
export const createPipelineSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
});

export const createStageSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  position: z.number().int().min(0),
  color: z.string().nullable().optional(),
});

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  website: z.string().trim().url('URL inválida').nullable().optional().or(z.literal('')),
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  email: z.string().trim().email('Email inválido').nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(30, 'Telefone muito longo').nullable().optional().or(z.literal('')),
  source: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  company_id: z.string().uuid().nullable().optional(),
});

export const createDealSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  pipeline_id: z.string().uuid('Pipeline inválido'),
  stage_id: z.string().uuid('Etapa inválida'),
  lead_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  value_cents: z.number().int().min(0, 'Valor não pode ser negativo').default(0),
  currency: z.string().default('BRL'),
  owner_user_id: z.string().uuid().nullable().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  description: z.string().trim().max(2000).nullable().optional().or(z.literal('')),
  due_at: z.string().nullable().optional(),
  deal_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  assigned_user_id: z.string().uuid().nullable().optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(50, 'Nome muito longo'),
  color: z.string().nullable().optional(),
});

// Inbox validators
export const createThreadSchema = z.object({
  channel_id: z.string().uuid('Canal inválido'),
  subject: z.string().trim().max(200, 'Assunto muito longo').nullable().optional(),
  related_entity: z.enum(['lead', 'deal', 'company']).nullable().optional(),
  related_entity_id: z.string().uuid().nullable().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Mensagem não pode ser vazia').max(5000, 'Mensagem muito longa'),
});

// Inferred types
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
