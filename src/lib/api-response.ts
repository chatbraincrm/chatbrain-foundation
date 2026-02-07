import type { ApiResponse } from '@/types';

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function apiError(code: string, message: string, details?: unknown): ApiResponse {
  return { ok: false, error: { code, message, details } };
}

export class AppError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}
