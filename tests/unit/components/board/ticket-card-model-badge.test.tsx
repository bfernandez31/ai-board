/**
 * Component Tests: TicketCard "Custom models" badge (AIB-678 / US3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';
import { Agent } from '@prisma/client';

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/hooks/mutations/useCancelJob', () => ({
  useCancelJob: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-has-mounted', () => ({
  useHasMounted: () => true,
}));

vi.mock('@/app/lib/utils/deploy-preview-eligibility', () => ({
  isTicketDeployable: () => false,
}));

vi.mock('@/components/board/job-status-indicator', () => ({
  JobStatusIndicator: () => null,
}));

vi.mock('@/components/board/ticket-card-deploy-icon', () => ({
  TicketCardDeployIcon: () => null,
}));

vi.mock('@/components/board/ticket-card-preview-icon', () => ({
  TicketCardPreviewIcon: () => null,
}));

vi.mock('@/components/board/deploy-confirmation-modal', () => ({
  DeployConfirmationModal: () => null,
}));

vi.mock('@/components/board/cancel-confirmation-modal', () => ({
  CancelConfirmationModal: () => null,
}));

vi.mock('@/components/ticket/quality-score-badge', () => ({
  QualityScoreBadge: () => null,
}));

vi.mock('@/lib/utils/job-type-classifier', () => ({
  classifyJobType: () => 'WORKFLOW',
}));

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
    workflowType: 'FULL',
    attachments: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    project: { clarificationPolicy: 'AUTO', defaultAgent: Agent.CLAUDE },
    jobs: [],
    ...overrides,
  };
}

describe('TicketCard — "Custom models" badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render the badge when all 5 model columns are null', () => {
    renderWithProviders(<TicketCard ticket={createTicket()} />);

    expect(screen.queryByTestId('custom-models-badge')).not.toBeInTheDocument();
  });

  it('renders the badge when at least one model column is non-null', () => {
    renderWithProviders(
      <TicketCard ticket={createTicket({ verifyModel: 'claude-opus-4-7' })} />
    );

    const badge = screen.getByTestId('custom-models-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-dormant', 'false');
  });

  it('applies the dormant variant when effective agent is non-Claude', () => {
    renderWithProviders(
      <TicketCard
        ticket={createTicket({
          agent: Agent.GEMINI,
          verifyModel: 'claude-opus-4-7',
        })}
      />
    );

    const badge = screen.getByTestId('custom-models-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-dormant', 'true');
  });
});
