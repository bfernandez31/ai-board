/**
 * RTL Component Tests: RetroSpecBadge
 *
 * Tests for the retro-spec status badge in the board.
 * Verifies rendering for generating, completed, and failed states.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { RetroSpecBadge } from '@/components/board/retro-spec-badge';
import type { RetroSpecJobDto } from '@/app/lib/hooks/useRetroSpecPolling';

// Mock the polling hook
const mockPollingReturn = {
  job: null,
  isGenerating: false,
  isCompleted: false,
  isFailed: false,
  error: null,
};

vi.mock('@/app/lib/hooks/useRetroSpecPolling', () => ({
  useRetroSpecPolling: () => mockPollingReturn,
}));

describe('RetroSpecBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(mockPollingReturn, {
      job: null,
      isGenerating: false,
      isCompleted: false,
      isFailed: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when no active job', () => {
    renderWithProviders(<RetroSpecBadge projectId={1} />);

    expect(screen.queryByTestId('retro-spec-badge')).not.toBeInTheDocument();
  });

  it('should render "Generating specs..." with spinner when generating', () => {
    mockPollingReturn.isGenerating = true;

    renderWithProviders(<RetroSpecBadge projectId={1} />);

    const badge = screen.getByTestId('retro-spec-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Generating specs...')).toBeInTheDocument();
  });

  it('should render "Specs ready" when completed recently', () => {
    mockPollingReturn.isCompleted = true;
    mockPollingReturn.job = {
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
    } as RetroSpecJobDto;

    renderWithProviders(<RetroSpecBadge projectId={1} />);

    const badge = screen.getByTestId('retro-spec-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Specs ready')).toBeInTheDocument();
  });

  it('should NOT render "Specs ready" when completed more than 30s ago', () => {
    mockPollingReturn.isCompleted = true;
    mockPollingReturn.job = {
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
    } as RetroSpecJobDto;

    renderWithProviders(<RetroSpecBadge projectId={1} />);

    expect(screen.queryByTestId('retro-spec-badge')).not.toBeInTheDocument();
  });

  it('should render error with retry button when failed', () => {
    mockPollingReturn.isFailed = true;

    renderWithProviders(<RetroSpecBadge projectId={1} />);

    const badge = screen.getByTestId('retro-spec-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Spec generation failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
