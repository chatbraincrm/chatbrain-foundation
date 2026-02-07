import { pgEnum } from 'drizzle-orm/pg-core';

export const appRoleEnum = pgEnum('app_role', ['admin', 'manager', 'agent']);
