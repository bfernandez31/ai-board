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
          agent: null,
          rank: 1,
          score: 95,
          rankRationale: 'Best value',
          quality: { state: 'available', value: 95 },
          qualityBreakdown: { state: 'unavailable', value: null },
          telemetry: {
            inputTokens: { state: 'available', value: 10 },
            outputTokens: { state: 'available', value: 5 },
            totalTokens: { state: 'available', value: 15 },
            durationMs: { state: 'available', value: 100 },
            costUsd: { state: 'available', value: 0.01 },
            jobCount: { state: 'available', value: 1 },
            primaryModel: { state: 'available', value: 'claude-sonnet-4-6' },
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
      decisionPoints: [
        {
          id: 1,
          title: 'Persistence source of truth',
          verdictTicketId: 1,
          verdictSummary: 'ABC-123 persists decision-point details directly.',
          rationale: 'The viewer should show saved decision-specific content.',
          displayOrder: 0,
          participantApproaches: [
            {
              ticketId: 1,
              ticketKey: 'ABC-123',
              summary: 'Maps structured output directly into saved rows.',
            },
          ],
        },
      ],
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

    expect(await screen.findByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Use ABC-123.')).toBeInTheDocument();
    expect(screen.getByText('Persistence source of truth')).toBeInTheDocument();
    expect(screen.getByText('ABC-123 persists decision-point details directly.')).toBeInTheDocument();
  });
});
