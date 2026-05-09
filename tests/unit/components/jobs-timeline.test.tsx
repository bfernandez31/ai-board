/**
 * Component Tests: JobsTimeline
 *
 * Covers the expandable Avg Context / Turn Count breakdown rows.
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
    pluginVersion: null,
    agentCliVersion: null,
    log: null,
    ...overrides,
  };
}

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

describe('JobsTimeline — plugin & CLI version rows (AIB-775)', () => {
  it('renders both versions with no "Non disponible" tooltip when both fields are set (US-1)', async () => {
    const job = makeJob({
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    const details = screen.getByTestId(`job-details-${job.id}`);
    expect(details).toHaveTextContent(/Plugin Version/i);
    expect(details).toHaveTextContent('1.0.1');
    expect(details).toHaveTextContent(/CLI Version/i);
    expect(details).toHaveTextContent('claude-code 0.5.12');

    const pluginRow = screen.getByTestId(`job-plugin-version-${job.id}`);
    expect(pluginRow).not.toHaveAttribute('title');
    const cliRow = screen.getByTestId(`job-cli-version-${job.id}`);
    expect(cliRow).not.toHaveAttribute('title');
  });

  it('renders em-dash with title="Non disponible" when both versions are null (US-2 #1 / #2)', async () => {
    const job = makeJob({
      pluginVersion: null,
      agentCliVersion: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheCreationTokens: null,
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    const details = screen.getByTestId(`job-details-${job.id}`);
    expect(details).toHaveTextContent(/Plugin Version/i);
    expect(details).toHaveTextContent(/CLI Version/i);

    const pluginRow = screen.getByTestId(`job-plugin-version-${job.id}`);
    expect(pluginRow).toHaveAttribute('title', 'Non disponible');
    expect(pluginRow.textContent).toMatch(/—/);
    const cliRow = screen.getByTestId(`job-cli-version-${job.id}`);
    expect(cliRow).toHaveAttribute('title', 'Non disponible');
    expect(cliRow.textContent).toMatch(/—/);
  });

  it('renders partial-null state: plugin set, CLI null with tooltip (US-2 #3)', async () => {
    const job = makeJob({
      pluginVersion: '1.0.1',
      agentCliVersion: null,
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    const pluginRow = screen.getByTestId(`job-plugin-version-${job.id}`);
    expect(pluginRow).not.toHaveAttribute('title');
    expect(pluginRow).toHaveTextContent('1.0.1');

    const cliRow = screen.getByTestId(`job-cli-version-${job.id}`);
    expect(cliRow).toHaveAttribute('title', 'Non disponible');
    expect(cliRow.textContent).toMatch(/—/);
  });

  it('expands a job that has only versions set (no telemetry, no preview)', async () => {
    const job = makeJob({
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });
    renderWithProviders(<JobsTimeline jobs={[job]} />);
    await userEvent.click(screen.getByTestId(`job-row-${job.id}`));

    expect(screen.getByTestId(`job-details-${job.id}`)).toBeInTheDocument();
  });
});
