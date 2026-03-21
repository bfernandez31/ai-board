import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonViewer } from '@/components/comparison/comparison-viewer';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

vi.mock('@/hooks/use-comparisons', () => ({
  useComparisonCheck: vi.fn(() => ({
    data: { hasComparisons: true, latestComparisonId: 1, count: 1 },
    isLoading: false,
    error: null,
  })),
  useComparisonList: vi.fn(() => ({
    data: {
      comparisons: [
        {
          id: 1,
          generatedAt: '2026-03-20T00:00:00.000Z',
          sourceTicketKey: 'ABC-123',
          participantTicketKeys: ['ABC-456'],
          winnerTicketKey: 'ABC-123',
          summary: 'ABC-123 won',
        },
      ],
    },
    isLoading: false,
  })),
  useComparisonDetail: vi.fn(() => ({
    data: {
      id: 1,
      generatedAt: '2026-03-20T00:00:00.000Z',
      sourceTicketId: 1,
      sourceTicketKey: 'ABC-123',
      markdownPath: 'specs/x/comparisons/test.md',
      summary: 'ABC-123 won',
      overallRecommendation: 'Use ABC-123.',
      keyDifferentiators: ['coverage'],
      winnerTicketId: 1,
      winnerTicketKey: 'ABC-123',
      participants: [
        {
          ticketId: 1,
          ticketKey: 'ABC-123',
          title: 'Winner',
          stage: 'VERIFY',
          workflowType: 'FULL',
          agent: 'CODEX',
          rank: 1,
          score: 95,
          rankRationale: 'Best value',
          quality: {
            state: 'available',
            value: 95,
            threshold: 'Excellent',
            details: {
              dimensions: [
                {
                  name: 'Compliance',
                  agentId: 'compliance',
                  score: 95,
                  weight: 0.4,
                  weightedScore: 38,
                },
              ],
              threshold: 'Excellent',
              computedAt: '2026-03-20T00:00:00.000Z',
            },
          },
          telemetry: {
            totalTokens: { state: 'available', value: 15 },
            inputTokens: { state: 'available', value: 10 },
            outputTokens: { state: 'available', value: 5 },
            durationMs: { state: 'available', value: 100 },
            costUsd: { state: 'available', value: 0.01 },
            jobCount: { state: 'available', value: 1 },
            primaryModel: { state: 'available', value: 'gpt-5.4' },
            bestValueFlags: { totalTokens: true, quality: true },
          },
          metrics: {
            linesAdded: 10,
            linesRemoved: 2,
            linesChanged: 12,
            filesChanged: 2,
            testFilesChanged: 1,
            changedFiles: [],
            bestValueFlags: { linesChanged: true },
          },
        },
      ],
      decisionPoints: [],
      complianceRows: [],
    },
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

describe('ComparisonViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the structured comparison dashboard', async () => {
    renderWithProviders(
      <ComparisonViewer
        projectId={1}
        ticketId={1}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Ranking and Recommendation')).toBeInTheDocument();
    expect(screen.getByText('Implementation Metrics')).toBeInTheDocument();
    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
    expect(screen.getByText('Use ABC-123.')).toBeInTheDocument();
    expect(screen.getAllByText('Best value').length).toBeGreaterThan(0);
  });
});
