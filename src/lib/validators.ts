import { z } from 'zod';

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

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
