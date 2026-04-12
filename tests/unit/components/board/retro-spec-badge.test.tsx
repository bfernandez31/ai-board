/**
 * RTL Component Tests: RetroSpecBadge
 *
 * Tests for the retro-spec status badge in the board.
 * Verifies rendering for generating, completed, and failed states.
 * The badge receives all state via props (no internal polling).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { RetroSpecBadge } from '@/components/board/retro-spec-badge';
import type { RetroSpecJobDto } from '@/app/lib/hooks/useRetroSpecPolling';

// Mock the modal to avoid complex dialog rendering
vi.mock('@/components/board/retro-spec-modal', () => ({
  RetroSpecModal: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="retro-spec-modal"><button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

const baseProps = {
  projectId: 1,
  isGenerating: false,
  isCompleted: false,
  isFailed: false,
  job: null as RetroSpecJobDto | null,
};

describe('RetroSpecBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when no active job', () => {
    renderWithProviders(<RetroSpecBadge {...baseProps} />);

    expect(screen.queryByTestId('retro-spec-badge')).not.toBeInTheDocument();
  });

  it('should render "Generating specs..." with spinner when generating', () => {
    renderWithProviders(<RetroSpecBadge {...baseProps} isGenerating={true} />);

    const badge = screen.getByTestId('retro-spec-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Generating specs...')).toBeInTheDocument();
  });

  it('should render "Specs ready" when completed recently', () => {
    const job: RetroSpecJobDto = {
      id: 1,
      projectId: 1,
      agent: 'CLAUDE',
      command: 'RETRO_SPEC',
      status: 'COMPLETED',
      depth: null,
      docUrl: null,
      workflowRunId: null,
      errorMessage: null,
      artifactSummary: null,
      startedAt: null,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(
      <RetroSpecBadge {...baseProps} isCompleted={true} job={job} />
    );

    const badge = screen.getByTestId('retro-spec-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Specs ready')).toBeInTheDocument();
  });

  it('should NOT render "Specs ready" when completed more than 30s ago', () => {
    const job: RetroSpecJobDto = {
      id: 1,
      projectId: 1,
      agent: 'CLAUDE',
      command: 'RETRO_SPEC',
      status: 'COMPLETED',
      depth: null,
      docUrl: null,
      workflowRunId: null,
      errorMessage: null,
      artifactSummary: null,
      startedAt: null,
      completedAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(
      <RetroSpecBadge {...baseProps} isCompleted={true} job={job} />
    );

    expect(screen.queryByTestId('retro-spec-badge')).not.toBeInTheDocument();
  });

  it('should render error with retry button when failed', () => {
    renderWithProviders(<RetroSpecBadge {...baseProps} isFailed={true} />);

    const badge = screen.getByTestId('retro-spec-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Spec generation failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
