import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Billing from '@/pages/Billing';

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({
    usage: { messages_count: 100, ai_messages_count: 30, threads_count: 5 },
    limits: {
      threads: 300,
      messages_per_month: 6000,
      ai_responses_per_month: 2000,
    },
    isLoading: false,
  }),
}));

describe('Billing page', () => {
  it('renders plan name and price', () => {
    render(<Billing />);
    expect(screen.getByText('ChatBrain Pro')).toBeInTheDocument();
    expect(screen.getByText(/R\$ 197\/mês/)).toBeInTheDocument();
  });

  it('renders usage labels', () => {
    render(<Billing />);
    expect(screen.getByText('Conversas')).toBeInTheDocument();
    expect(screen.getByText('Mensagens')).toBeInTheDocument();
    expect(screen.getByText('Respostas do agente')).toBeInTheDocument();
  });

  it('shows support copy', () => {
    render(<Billing />);
    expect(screen.getByText(/Para alterar seu plano ou limites, fale com nosso time no WhatsApp/)).toBeInTheDocument();
  });
});
