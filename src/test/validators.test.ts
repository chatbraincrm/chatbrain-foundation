import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema, createTenantSchema, createInviteSchema, updatePasswordSchema } from '@/lib/validators';

describe('loginSchema', () => {
  it('validates valid input', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '123456' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-email', password: '123456' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '123' });
    expect(result.success).toBe(false);
  });

  it('trims email whitespace', () => {
    const result = loginSchema.safeParse({ email: '  test@example.com  ', password: '123456' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });
});

describe('signupSchema', () => {
  it('validates valid input', () => {
    const result = signupSchema.safeParse({ email: 'test@example.com', password: '123456', name: 'Test User' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = signupSchema.safeParse({ email: 'test@example.com', password: '123456', name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name with only spaces', () => {
    const result = signupSchema.safeParse({ email: 'test@example.com', password: '123456', name: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('createTenantSchema', () => {
  it('validates valid input', () => {
    const result = createTenantSchema.safeParse({ name: 'My Tenant', slug: 'my-tenant' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid slug with uppercase', () => {
    const result = createTenantSchema.safeParse({ name: 'My Tenant', slug: 'My-Tenant' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with special characters', () => {
    const result = createTenantSchema.safeParse({ name: 'My Tenant', slug: 'my_tenant!' });
    expect(result.success).toBe(false);
  });

  it('accepts slug with numbers and hyphens', () => {
    const result = createTenantSchema.safeParse({ name: 'Tenant 123', slug: 'tenant-123' });
    expect(result.success).toBe(true);
  });
});

describe('createInviteSchema', () => {
  it('validates valid input', () => {
    const result = createInviteSchema.safeParse({ email: 'test@example.com', role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('accepts all valid roles', () => {
    expect(createInviteSchema.safeParse({ email: 'a@b.com', role: 'admin' }).success).toBe(true);
    expect(createInviteSchema.safeParse({ email: 'a@b.com', role: 'manager' }).success).toBe(true);
    expect(createInviteSchema.safeParse({ email: 'a@b.com', role: 'agent' }).success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = createInviteSchema.safeParse({ email: 'test@example.com', role: 'superadmin' });
    expect(result.success).toBe(false);
  });
});

describe('updatePasswordSchema', () => {
  it('validates matching passwords', () => {
    const result = updatePasswordSchema.safeParse({ password: '123456', confirmPassword: '123456' });
    expect(result.success).toBe(true);
  });

  it('rejects non-matching passwords', () => {
    const result = updatePasswordSchema.safeParse({ password: '123456', confirmPassword: '654321' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = updatePasswordSchema.safeParse({ password: '123', confirmPassword: '123' });
    expect(result.success).toBe(false);
  });
});
