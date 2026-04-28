import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('renders the running placeholder with aria-busy', async () => {
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
      expect(screen.getByText(/Running analysis/i)).toBeInTheDocument();
    });
    const panel = screen.getByTestId('inbox-analysis-panel');
    expect(panel.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders success branch with all fields populated', async () => {
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
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-success')).toBeInTheDocument();
    });
    expect(screen.getByTestId('friction-risk-badge')).toHaveTextContent('medium');
    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('high');
    expect(screen.getByTestId('quality-gate-range')).toHaveTextContent('70–85');
    expect(screen.getByTestId('recommendation-choice')).toHaveTextContent('FULL');
    expect(screen.getByTestId('cost-range')).toHaveTextContent('Baseline');
    expect(screen.getByTestId('scope-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-AIB-100')).toBeInTheDocument();
  });

  it('renders cold-start branch without numeric ranges', async () => {
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
        output: { scopeWarnings: [] },
        stale: false,
      },
      eligibility: emptyEligibility(),
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-cold-start')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('quality-gate-range')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cost-range')).not.toBeInTheDocument();
    expect(screen.queryByTestId('analysis-success')).not.toBeInTheDocument();
  });

  it('renders failed branch with retry button when triggerable', async () => {
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
      expect(screen.getByTestId('analysis-retry')).toBeInTheDocument();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Analysis failed/i);
  });

  it('hides trigger button when not triggerable but renders persisted analysis', async () => {
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
      expect(screen.getByTestId('analysis-success')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('inbox-analysis-trigger')).not.toBeInTheDocument();
  });

  it('applies aurora styling on the success card', async () => {
    mockFetchOnce({
      latest: {
        id: 6,
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
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
        stale: false,
      },
      eligibility: emptyEligibility(),
    });
    renderWithProviders(
      <InboxAnalysisPanel projectId={PROJECT_ID} ticketId={TICKET_ID} triggerable={true} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('analysis-success')).toBeInTheDocument();
    });
    const card = screen.getByTestId('analysis-success');
    expect(card.className).toMatch(/aurora-bg-card-blue/);
  });
});
