import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { InboxAnalysisPanel } from '@/components/ticket/inbox-analysis-panel';
import type { AnalysisQueryResult } from '@/app/lib/hooks/queries/useTicketAnalysis';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const PROJECT_ID = 7;
const TICKET_ID = 1234;

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function mockFetchOnce(response: AnalysisQueryResult): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
  } satisfies MockResponse) as unknown as typeof fetch;
}

function emptyEligibility() {
  return {
    triggerable: true,
    estimatedCostUsd: { lower: 0.04, upper: 0.08 },
    rateLimit: { limitPerHour: 10, remaining: 10, nextResetAt: null },
  };
}

describe('InboxAnalysisPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when there is no analysis and the ticket is not triggerable', async () => {
    mockFetchOnce({ latest: null, eligibility: { ...emptyEligibility(), triggerable: false } });
    const { container } = renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={false} />
    );
    // Wait one tick for the query to settle, then assert nothing rendered.
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByText(/no analysis available/i)).not.toBeInTheDocument();
  });

  it('renders only the Run analysis trigger (no INBOX label, no inline cost) when empty and triggerable', async () => {
    mockFetchOnce({ latest: null, eligibility: emptyEligibility() });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    // After the eligibility query resolves, the aria-label exposes the cost for screen readers.
    await waitFor(() => {
      const t = screen.getByTestId('inbox-analysis-trigger');
      expect(t.getAttribute('aria-label')).toMatch(/cost/i);
    });
    const trigger = screen.getByTestId('inbox-analysis-trigger');
    expect(trigger).toHaveTextContent(/Run analysis/i);
    // Cost should NOT appear in the visible button label, only in aria-label/tooltip.
    expect(trigger.textContent ?? '').not.toMatch(/\$\d/);
    // No "INBOX ANALYSIS" header/label.
    expect(screen.queryByText(/inbox analysis/i)).not.toBeInTheDocument();
  });

  it('renders the running state on a single line with aria-busy', async () => {
    mockFetchOnce({
      latest: {
        id: 1,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'running',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: null, durationMs: null, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: null,
        errorMessage: null,
        output: null,
        stale: false,
      },
      eligibility: emptyEligibility(),
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-running-row')).toBeInTheDocument();
    });
    expect(screen.getByText(/Analyzing/i)).toBeInTheDocument();
    expect(screen.getByTestId('analysis-running-row')).toHaveAttribute('aria-busy', 'true');
    // No additional card / no expand toggle while running.
    expect(screen.queryByTestId('analysis-expand-toggle')).not.toBeInTheDocument();
  });

  it('collapses success state into chips + meta and reveals details only when expanded', async () => {
    mockFetchOnce({
      latest: {
        id: 2,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'success',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: 'claude-opus-4-7',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: 0.05, durationMs: 12000, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: null,
        errorMessage: null,
        output: {
          frictionRisk: 'medium',
          qualityGateRange: { lower: 70, upper: 85 },
          recommendation: { choice: 'FULL', confidence: 'high', justification: 'Anchor #1 indicates risk in tests.' },
          costRange: { baselineLowerUsd: 0.10, baselineUpperUsd: 0.20, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.05 },
          scopeWarnings: [{ category: 'ambiguity_core_requirement', message: 'Ambiguous core' }],
          anchors: [
            { ticketId: 100, ticketKey: 'AIB-100', frictionFree: true, qualityScore: 88, overlapStrength: 2, tombstoned: false },
          ],
        },
        stale: false,
      },
      eligibility: emptyEligibility(),
    });
    const user = userEvent.setup();
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-success-row')).toBeInTheDocument();
    });
    // Collapsed view: three chips visible, no expanded body.
    expect(screen.getByTestId('recommendation-chip')).toHaveTextContent('FULL');
    expect(screen.getByTestId('friction-risk-badge')).toHaveTextContent('medium');
    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('high');
    expect(screen.getByTestId('analysis-meta')).toHaveTextContent(/analyzed/i);
    expect(screen.queryByTestId('analysis-expanded')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quality-gate-range')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cost-range')).not.toBeInTheDocument();

    // Expand and assert all original details are accessible.
    const toggle = screen.getByTestId('analysis-expand-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('analysis-success')).toBeInTheDocument();
    expect(screen.getByTestId('quality-gate-range')).toHaveTextContent('70–85');
    expect(screen.getByTestId('cost-range')).toHaveTextContent('Baseline');
    expect(screen.getByTestId('recommendation-choice')).toHaveTextContent('FULL');
    expect(screen.getByTestId('recommendation-justification')).toHaveTextContent(/Anchor #1/);
    expect(screen.getByTestId('scope-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-AIB-100')).toBeInTheDocument();
  });

  it('exposes the stale indicator and inline re-analyze action when description changed since analysis', async () => {
    mockFetchOnce({
      latest: {
        id: 7,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'success',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: 'claude-opus-4-7',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: 0.05, durationMs: 12000, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: null,
        errorMessage: null,
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
        stale: true,
      },
      eligibility: emptyEligibility(),
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-success-row')).toBeInTheDocument();
    });
    expect(screen.getByTestId('analysis-stale-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('reanalyze-button')).toBeInTheDocument();
    // The standalone "Description changed" banner must NOT exist anymore.
    expect(screen.queryByTestId('description-changed-banner')).not.toBeInTheDocument();
  });

  it('renders cold-start collapsed and reveals scope warnings on expand', async () => {
    mockFetchOnce({
      latest: {
        id: 3,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'cold_start',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: 0.01, durationMs: 1000, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: 'insufficient_comparable_history',
        errorReason: null,
        errorMessage: null,
        output: { scopeWarnings: [{ category: 'ambiguity_core_requirement', message: 'Ambiguous core' }] },
        stale: false,
      },
      eligibility: emptyEligibility(),
    });
    const user = userEvent.setup();
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-cold-start-row')).toBeInTheDocument();
    });
    expect(screen.getByText(/Cold start/i)).toBeInTheDocument();
    // Expanded body hidden by default.
    expect(screen.queryByTestId('analysis-cold-start')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('analysis-expand-toggle'));
    expect(screen.getByTestId('analysis-cold-start')).toBeInTheDocument();
    expect(screen.getByTestId('scope-warnings')).toHaveTextContent('Ambiguous core');
  });

  it('renders failed branch on a single line with retry button when triggerable', async () => {
    mockFetchOnce({
      latest: {
        id: 4,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'failed',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: null, durationMs: null, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: 'grounded_pass_failed',
        errorMessage: 'LLM error',
        output: null,
        stale: false,
      },
      eligibility: emptyEligibility(),
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-failed-row')).toBeInTheDocument();
    });
    expect(screen.getByTestId('analysis-retry')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Analysis failed/i);
    // The error message lives behind a tooltip on the warning icon, not as inline body text.
    expect(screen.getByTestId('analysis-failed-icon')).toBeInTheDocument();
  });

  it('renders failed branch without retry button when not triggerable', async () => {
    mockFetchOnce({
      latest: {
        id: 6,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'failed',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: null, durationMs: null, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: 'grounded_pass_failed',
        errorMessage: 'LLM error',
        output: null,
        stale: false,
      },
      eligibility: { ...emptyEligibility(), triggerable: false },
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={false} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-failed-row')).toBeInTheDocument();
    });
    // Warning icon and "Analysis failed" label still render (error tooltip remains accessible)…
    expect(screen.getByTestId('analysis-failed-icon')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Analysis failed/i);
    // …but the inline retry action is hidden because the ticket is no longer triggerable.
    expect(screen.queryByTestId('analysis-retry')).not.toBeInTheDocument();
  });

  it('disables retry on the failed row when the hourly rate limit is exhausted', async () => {
    mockFetchOnce({
      latest: {
        id: 8,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'failed',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: null, durationMs: null, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: 'grounded_pass_failed',
        errorMessage: 'LLM error',
        output: null,
        stale: false,
      },
      eligibility: {
        ...emptyEligibility(),
        rateLimit: { limitPerHour: 10, remaining: 0, nextResetAt: '2026-01-01T01:00:00Z' },
      },
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-retry')).toBeInTheDocument();
    });
    expect(screen.getByTestId('analysis-retry')).toBeDisabled();
  });

  it('hides trigger when not triggerable but still renders the persisted analysis row', async () => {
    mockFetchOnce({
      latest: {
        id: 5,
        ticketId: TICKET_ID,
        projectId: PROJECT_ID,
        userId: 'u1',
        status: 'success',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        modelId: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        titleSnapshot: 'T',
        descriptionSnapshot: 'D',
        stackSnapshot: null,
        telemetry: { costUsd: 0.05, durationMs: 12000, inputTokens: null, outputTokens: null, thinkingTokens: null, cacheReadTokens: null },
        coldStartReason: null,
        errorReason: null,
        errorMessage: null,
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'Stack=postgres+nextjs; small change.' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
        stale: false,
      },
      eligibility: { ...emptyEligibility(), triggerable: false },
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={false} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-success-row')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('inbox-analysis-trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('recommendation-chip')).toHaveTextContent('QUICK');
  });
});
