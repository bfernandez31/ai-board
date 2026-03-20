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
import { QUALITY_SCORE_DIMENSIONS } from '@/lib/quality-score';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

function createMockDetails(scores: number[]): string {
  return JSON.stringify({
    dimensions: QUALITY_SCORE_DIMENSIONS.map((dimension, index) => {
      const score = scores[index] ?? 0;

      return {
        ...dimension,
        score,
        weightedScore: score * dimension.weight,
      };
    }),
    threshold: 'Good',
    computedAt: '2026-03-17T10:30:00Z',
  });
}

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
    qualityScore: 83,
    qualityScoreDetails: createMockDetails([80, 90, 70, 85, 95]),
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
    expect(screen.getByTestId('quality-score-value')).toHaveTextContent('83');
    expect(screen.getByTestId('quality-score-threshold')).toHaveTextContent('Good');
  });

  it('keeps dimension scores hidden until the section is expanded', () => {
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);

    for (const dimension of QUALITY_SCORE_DIMENSIONS) {
      expect(
        screen.queryByTestId(`dimension-${dimension.agentId}`)
      ).not.toBeInTheDocument();
    }
  });

  it('shows dimension weights as percentages after expanding the section', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    const complianceDim = screen.getByTestId('dimension-compliance');
    expect(complianceDim).toHaveTextContent('40%');
    expect(screen.getByTestId('dimension-spec-sync')).toHaveTextContent('0%');
  });

  it('toggles score breakdown details when the score card is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QualityScoreSection jobs={[createJob()]} />);

    expect(screen.queryByTestId('dimension-breakdown')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    expect(screen.getByTestId('dimension-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('dimension-compliance')).toHaveTextContent('80');
    expect(screen.getByTestId('dimension-bug-detection')).toHaveTextContent('90');
    expect(screen.getByTestId('dimension-spec-sync')).toHaveTextContent('95');

    await user.click(screen.getByRole('button', { name: /quality score details/i }));

    expect(screen.queryByTestId('dimension-breakdown')).not.toBeInTheDocument();
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
