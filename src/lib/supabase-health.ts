/**
 * Supabase connection health check.
 * Runs once on app startup to verify connectivity.
 */
import { supabase } from '@/lib/supabase';

export async function checkSupabaseConnection(): Promise<void> {
  try {
    // Simple query to verify database connectivity
    const { error } = await supabase.from('tenants').select('id').limit(1);

    if (error) {
      console.error(
        '❌ [Supabase] Falha na conexão com o banco:',
        error.message,
        '\n   Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão corretos.'
      );
      return;
    }

    console.info('✅ [Supabase] Conectado com sucesso.');
  } catch (err) {
    console.error(
      '❌ [Supabase] Erro inesperado ao verificar conexão:',
      err instanceof Error ? err.message : err,
      '\n   Verifique se a URL do Supabase está acessível.'
    );
  }
}
