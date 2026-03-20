/**
 * Component Tests: QualityScoreSection
 *
 * Tests dimension breakdown rendering, latest score selection from multiple
 * verify jobs, and null/missing state.
 */

import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { QualityScoreSection } from '@/components/ticket/quality-score-section';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

const MOCK_DETAILS = JSON.stringify({
  dimensions: [
    { name: 'Compliance', agentId: 'compliance', score: 80, weight: 0.4, weightedScore: 32 },
    { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
    { name: 'Code Comments', agentId: 'code-comments', score: 70, weight: 0.2, weightedScore: 14 },
    { name: 'Historical Context', agentId: 'historical-context', score: 85, weight: 0.1, weightedScore: 8.5 },
    { name: 'Spec Sync', agentId: 'spec-sync', score: 95, weight: 0.0, weightedScore: 0 },
  ],
  threshold: 'Good',
  computedAt: '2026-03-17T10:30:00Z',
});

function createJob(overrides: Partial<TicketJobWithTelemetry> = {}): TicketJobWithTelemetry {
  return {
    id: 1,
    command: 'verify',
    status: 'COMPLETED',
    startedAt: '2026-03-17T10:00:00Z',
    completedAt: '2026-03-17T10:30:00Z',
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
    costUsd: null,
    durationMs: null,
    model: null,
    toolsUsed: [],
    qualityScore: 82,
    qualityScoreDetails: MOCK_DETAILS,
    ...overrides,
  };
}

describe('QualityScoreSection', () => {
  it('renders nothing when no jobs have quality scores', () => {
    const jobs = [createJob({ qualityScore: null, qualityScoreDetails: null })];
    const { container } = renderWithProviders(<QualityScoreSection jobs={jobs} />);
    expect(container.querySelector('[data-testid="quality-score-section"]')).toBeNull();
  });

  it('renders nothing when there are no verify jobs', () => {
    const jobs = [createJob({ command: 'specify', qualityScore: 83 })];
    const { container } = renderWithProviders(<QualityScoreSection jobs={jobs} />);
    expect(container.querySelector('[data-testid="quality-score-section"]')).toBeNull();
  });

  it('displays overall score and threshold label', () => {
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);
    expect(screen.getByTestId('quality-score-value')).toHaveTextContent('82');
    expect(screen.getByTestId('quality-score-threshold')).toHaveTextContent('Good');
  });

  it('keeps dimension scores hidden until the section is expanded', () => {
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);
    expect(screen.queryByTestId('dimension-bug-detection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dimension-compliance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dimension-code-comments')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dimension-historical-context')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dimension-spec-sync')).not.toBeInTheDocument();
  });

  it('shows dimension weights as percentages after expanding the section', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    const bugDim = screen.getByTestId('dimension-bug-detection');
    expect(bugDim).toHaveTextContent('30%');
  });

  it('toggles score breakdown details when the score card is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);

    expect(screen.queryByTestId('dimension-breakdown')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    expect(screen.getByTestId('dimension-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('dimension-bug-detection')).toHaveTextContent('90');

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    expect(screen.queryByTestId('dimension-breakdown')).not.toBeInTheDocument();
  });

  it('renders old pr-comments dimension data correctly', async () => {
    const user = userEvent.setup();
    const oldDetails = JSON.stringify({
      dimensions: [
        { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
        { name: 'Compliance', agentId: 'compliance', score: 80, weight: 0.3, weightedScore: 24 },
        { name: 'Code Comments', agentId: 'code-comments', score: 70, weight: 0.2, weightedScore: 14 },
        { name: 'Historical Context', agentId: 'historical-context', score: 85, weight: 0.1, weightedScore: 8.5 },
        { name: 'PR Comments', agentId: 'pr-comments', score: 95, weight: 0.1, weightedScore: 9.5 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-16T10:30:00Z',
    });
    const job = createJob({ qualityScore: 83, qualityScoreDetails: oldDetails });
    renderWithProviders(<QualityScoreSection jobs={[job]} />);

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    expect(screen.getByTestId('dimension-pr-comments')).toBeInTheDocument();
    expect(screen.getByTestId('dimension-pr-comments')).toHaveTextContent('95');
  });

  it('selects latest COMPLETED verify job when multiple exist', () => {
    const olderJob = createJob({
      id: 1,
      qualityScore: 60,
      startedAt: '2026-03-16T10:00:00Z',
    });
    const newerJob = createJob({
      id: 2,
      qualityScore: 92,
      startedAt: '2026-03-17T10:00:00Z',
      qualityScoreDetails: JSON.stringify({
        dimensions: [],
        threshold: 'Excellent',
        computedAt: '2026-03-17T10:30:00Z',
      }),
    });
    renderWithProviders(<QualityScoreSection jobs={[olderJob, newerJob]} />);
    expect(screen.getByTestId('quality-score-value')).toHaveTextContent('92');
    expect(screen.getByTestId('quality-score-threshold')).toHaveTextContent('Excellent');
  });
});
