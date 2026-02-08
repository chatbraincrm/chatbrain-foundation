/**
 * Custom Supabase client pointing to the EXTERNAL project.
 *
 * ALL application code must import from here:
 *   import { supabase } from '@/lib/supabase';
 *
 * Do NOT import from '@/integrations/supabase/client' — that file
 * is auto-managed by Lovable and points to the Cloud project.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabaseUrl, supabaseAnonKey, supabaseProjectRef } from './env';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Log project ref in development
if (import.meta.env.DEV) {
  console.info(`🔗 [Supabase] Using project: ${supabaseProjectRef}`);
}
