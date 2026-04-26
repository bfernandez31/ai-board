/**
 * Component Tests: JobsTimeline (AIB-725)
 *
 * Covers the peak-context pill (visibility, threshold variants, null handling)
 * and the expandable Avg Context / Turn Count breakdown rows.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { JobsTimeline } from '@/components/ticket/jobs-timeline';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

// useCancelJob hits TanStack Query mutation infra; jobs-timeline tests don't
// exercise cancellation, so we stub it to avoid wiring a full QueryClient.
vi.mock('@/lib/hooks/mutations/useCancelJob', () => ({
  useCancelJob: () => ({ mutate: vi.fn(), isPending: false }),
}));

const CLAUDE_WINDOW = 200_000;

function makeJob(overrides: Partial<TicketJobWithTelemetry> = {}): TicketJobWithTelemetry {
  return {
    id: 1,
    command: 'specify',
    status: 'COMPLETED',
    branch: null,
    startedAt: new Date('2026-04-25T00:00:00Z').toISOString(),
    completedAt: new Date('2026-04-25T00:01:00Z').toISOString(),
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    costUsd: 0.05,
    durationMs: 60000,
    model: 'claude-sonnet-4-6',
    toolsUsed: ['Read', 'Write'],
    qualityScore: null,
    qualityScoreDetails: null,
    peakContextTokens: null,
    avgContextTokens: null,
    turnCount: null,
    log: null,
    ...overrides,
  };
}

describe('JobsTimeline — peak-context pill (US1)', () => {
  it('renders the pill with healthy/neutral classes well under 60% of context window', () => {
    const job = makeJob({ peakContextTokens: 50_000 }); // 25%
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    const pill = screen.getByTestId(`job-peak-context-${job.id}`);
    expect(pill.className).toContain('text-ctp-overlay1');
  });

  it('renders the pill with warning classes between 60% and 80%', () => {
    const job = makeJob({ peakContextTokens: Math.round(CLAUDE_WINDOW * 0.7) }); // 70%
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    const pill = screen.getByTestId(`job-peak-context-${job.id}`);
    expect(pill.className).toContain('text-ctp-yellow');
  });

  it('renders the pill with danger classes at or above 80%', () => {
    const job = makeJob({ peakContextTokens: Math.round(CLAUDE_WINDOW * 0.85) }); // 85%
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    const pill = screen.getByTestId(`job-peak-context-${job.id}`);
    expect(pill.className).toContain('text-ctp-red');
  });

  it('does NOT render the pill when peakContextTokens is null', () => {
    const job = makeJob({ peakContextTokens: null });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    expect(screen.queryByTestId(`job-peak-context-${job.id}`)).toBeNull();
  });

  it('does NOT render the pill when model is null', () => {
    const job = makeJob({ peakContextTokens: 50_000, model: null });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    expect(screen.queryByTestId(`job-peak-context-${job.id}`)).toBeNull();
  });

  it('does NOT render the pill when model is unmapped (Mistral)', () => {
    const job = makeJob({
      peakContextTokens: 50_000,
      model: 'mistral-large-latest',
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    expect(screen.queryByTestId(`job-peak-context-${job.id}`)).toBeNull();
  });

  it('uses a tooltip that includes the abbreviated peak and percent of window', () => {
    const peak = 120_000;
    const job = makeJob({ peakContextTokens: peak });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    const pill = screen.getByTestId(`job-peak-context-${job.id}`);
    const title = pill.getAttribute('title') ?? '';
    expect(title).toContain('120.0K');
    expect(title).toContain('60%');
    expect(title).toContain('200.0K');
  });
});

describe('JobsTimeline — expanded breakdown rows (US3)', () => {
  it('shows Avg Context and Turn Count rows for a Claude job with both fields set', async () => {
    const job = makeJob({
      peakContextTokens: 60_000,
      avgContextTokens: 42_500,
      turnCount: 7,
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    const details = screen.getByTestId(`job-details-${job.id}`);
    expect(details).toHaveTextContent(/Avg Context/i);
    expect(details).toHaveTextContent(/42\.5K/);
    expect(details).toHaveTextContent(/Turn Count/i);
    expect(details).toHaveTextContent(/7/);
  });

  it('omits both rows for a Mistral job (peak/avg/turnCount all null)', async () => {
    const job = makeJob({
      model: 'mistral-large-latest',
      peakContextTokens: null,
      avgContextTokens: null,
      turnCount: null,
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    const details = screen.getByTestId(`job-details-${job.id}`);
    expect(details.textContent).not.toMatch(/Avg Context/i);
    expect(details.textContent).not.toMatch(/Turn Count/i);
  });

  it('omits both rows for a Gemini job that has only peak set (FR-009)', async () => {
    const job = makeJob({
      model: 'gemini-2.5-pro',
      peakContextTokens: 80_000,
      avgContextTokens: null,
      turnCount: null,
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    const details = screen.getByTestId(`job-details-${job.id}`);
    expect(details.textContent).not.toMatch(/Avg Context/i);
    expect(details.textContent).not.toMatch(/Turn Count/i);
  });
});
