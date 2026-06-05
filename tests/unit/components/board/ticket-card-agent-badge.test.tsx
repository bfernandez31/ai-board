/**
 * Component Tests: TicketCardAgentBadge (extracted from TicketCard — AIB-846)
 *
 * Also guards the AIB-847 fix: codex stage-model fields are indexed directly off
 * the typed ticket (no `as unknown as Record<...>` escape), so a codex override
 * must surface the "custom models" badge just like a Claude override.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { TicketCardAgentBadge } from '@/components/board/ticket-card-agent-badge';
import type { TicketWithVersion } from '@/lib/types';
import { Agent } from '@prisma/client';

function createTicket(overrides: Partial<TicketWithVersion> = {}): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Test ticket',
    description: null,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: Agent.CLAUDE,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    codexSpecifyModel: null,
    codexPlanModel: null,
    codexImplementModel: null,
    codexQuickImplModel: null,
    codexVerifyModel: null,
    workflowType: 'FULL',
    tokenSaving: null,
    attachments: [],
    qualityScore: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    project: { clarificationPolicy: 'AUTO', defaultAgent: Agent.CLAUDE },
    jobs: [],
    ...overrides,
  };
}

describe('TicketCardAgentBadge', () => {
  it('renders the agent badge for the effective agent', () => {
    renderWithProviders(<TicketCardAgentBadge ticket={createTicket()} />);

    expect(screen.getByTestId('agent-badge')).toBeInTheDocument();
  });

  it('falls back to the project default agent when ticket.agent is null', () => {
    renderWithProviders(
      <TicketCardAgentBadge
        ticket={createTicket({ agent: null, project: { clarificationPolicy: 'AUTO', defaultAgent: Agent.CODEX } })}
      />
    );

    expect(screen.getByTestId('agent-badge')).toBeInTheDocument();
  });

  it('renders nothing when no effective agent can be resolved', () => {
    renderWithProviders(
      <TicketCardAgentBadge ticket={createTicket({ agent: null, project: { clarificationPolicy: 'AUTO' } })} />
    );

    expect(screen.queryByTestId('agent-badge')).not.toBeInTheDocument();
  });

  it('does not render the custom-models badge when all model columns are null', () => {
    renderWithProviders(<TicketCardAgentBadge ticket={createTicket()} />);

    expect(screen.queryByTestId('custom-models-badge')).not.toBeInTheDocument();
  });

  it('surfaces the custom-models badge for a Claude stage-model override', () => {
    renderWithProviders(
      <TicketCardAgentBadge ticket={createTicket({ verifyModel: 'claude-opus-4-7' })} />
    );

    const badge = screen.getByTestId('custom-models-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-dormant', 'false');
  });

  it('surfaces the custom-models badge for a Codex stage-model override (AIB-847)', () => {
    renderWithProviders(
      <TicketCardAgentBadge
        ticket={createTicket({ agent: Agent.CODEX, codexVerifyModel: 'gpt-5.5' })}
      />
    );

    const badge = screen.getByTestId('custom-models-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-dormant', 'false');
  });

  it('marks the badge dormant when overrides do not apply to the effective agent', () => {
    renderWithProviders(
      <TicketCardAgentBadge
        ticket={createTicket({ agent: Agent.GEMINI, verifyModel: 'claude-opus-4-7' })}
      />
    );

    expect(screen.getByTestId('custom-models-badge')).toHaveAttribute('data-dormant', 'true');
  });
});
