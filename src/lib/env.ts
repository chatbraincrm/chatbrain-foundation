/**
 * Configuração de ambiente (frontend).
 * Usa apenas variáveis VITE_* — segredos nunca aqui.
 * Roda 100% com .env / .env.local (não depende de Lovable Cloud).
 */

function getEnv(key: string): string {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  const v = (import.meta.env as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() : '';
}

export const supabaseUrl = getEnv('VITE_SUPABASE_URL') || '';
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || '';

/** Project ref extraído do hostname da URL (ex.: xxx.supabase.co → xxx) */
export const supabaseProjectRef = supabaseUrl
  ? (() => {
      try {
        const h = new URL(supabaseUrl).hostname;
        return h.replace(/\.supabase\.co$/, '') || h;
      } catch {
        return '';
      }
    })()
  : '';

/** Optional: OpenAI API key for AI agent. If missing, agent won't reply. */
export const openAiApiKey =
  getEnv('VITE_OPENAI_API_KEY') || null;
