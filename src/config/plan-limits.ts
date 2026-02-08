/**
 * Limites do plano ChatBrain Pro (V1).
 * Tudo configurável aqui; billing externo (Stripe) fica para V2.
 */

export const PLAN_NAME = 'ChatBrain Pro' as const;
export const PLAN_PRICE_MONTHLY = 197; // R$/mês

export const PLAN_LIMITS = {
  /** Máximo de conversas (threads) criadas no mês */
  threads: 300,
  /** Mensagens totais no mês (envio + recebimento) */
  messages_per_month: 6000,
  /** Respostas do agente de atendimento no mês */
  ai_responses_per_month: 2000,
  /** Conexões WhatsApp por tenant */
  whatsapp_connections: 1,
  /** Usuários (membros) no workspace */
  users: 3,
} as const;

export type PlanLimits = typeof PLAN_LIMITS;
