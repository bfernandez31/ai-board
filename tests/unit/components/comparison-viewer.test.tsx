import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ComparisonViewer } from '@/components/comparison/comparison-viewer';

vi.mock('@/hooks/use-comparisons', () => ({
  useComparisonCheck: vi.fn(() => ({
    data: { hasComparisons: true, latestReport: '20260320-130000-vs-AIB-401.md', count: 2 },
    isLoading: false,
    error: null,
  })),
  useComparisonList: vi.fn(() => ({
    data: {
      comparisons: [
        {
          filename: '20260320-130000-vs-AIB-401.md',
          generatedAt: '2026-03-20T13:00:00.000Z',
          sourceTicket: 'AIB-400',
          comparedTickets: ['AIB-401'],
          alignmentScore: 90,
          isAligned: true,
          winnerTicketKey: 'AIB-401',
          winnerScore: 90,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    },
    isLoading: false,
  })),
  useComparisonReport: vi.fn(() => ({
    data: {
      comparison: {
        filename: '20260320-130000-vs-AIB-401.md',
        generatedAt: '2026-03-20T13:00:00.000Z',
        recommendation: 'Ship AIB-401.',
        summary: 'AIB-401 wins on maintainability and tests.',
        sourceTicket: {
          id: 1,
          ticketKey: 'AIB-400',
          title: 'Source ticket',
        },
        winnerTicket: {
          id: 2,
          ticketKey: 'AIB-401',
          title: 'Variant ticket',
        },
        tickets: [
          {
            ticketId: 2,
            ticketKey: 'AIB-401',
            title: 'Variant ticket',
            workflowType: 'QUICK',
            stage: 'VERIFY',
            agent: 'CLAUDE',
            rank: 1,
            score: 90,
            verdictSummary: 'Best mix of quality and speed.',
            keyDifferentiators: ['Best test ratio', 'Highest quality score'],
            metrics: {
              linesAdded: 115,
              linesRemoved: 30,
              sourceFiles: 5,
              testFiles: 2,
              testRatio: 0.4,
            },
            telemetry: {
              ticketKey: 'AIB-401',
              inputTokens: 800,
              outputTokens: 200,
              cacheReadTokens: 0,
              cacheCreationTokens: 0,
              costUsd: 0.06,
              durationMs: 85000,
              model: 'gpt-5.4-mini',
              toolsUsed: ['Read', 'Bash'],
              jobCount: 1,
              hasData: true,
            },
            qualityScore: {
              score: 90,
              threshold: 'Excellent',
            },
            constitution: {
              overall: 94,
              principles: [
                {
                  principle: 'Test-Driven Development',
                  status: 'pass',
                  summary: 'Strong coverage around the main flow.',
                },
              ],
            },
          },
          {
            ticketId: 1,
            ticketKey: 'AIB-400',
            title: 'Source ticket',
            workflowType: 'FULL',
            stage: 'VERIFY',
            agent: 'CODEX',
            rank: 2,
            score: 82,
            verdictSummary: 'Good baseline with less test coverage.',
            keyDifferentiators: ['Lower code churn'],
            metrics: {
              linesAdded: 100,
              linesRemoved: 20,
              sourceFiles: 4,
              testFiles: 1,
              testRatio: 0.25,
            },
            telemetry: {
              ticketKey: 'AIB-400',
              inputTokens: 1200,
              outputTokens: 300,
              cacheReadTokens: 0,
              cacheCreationTokens: 0,
              costUsd: 0.09,
              durationMs: 100000,
              model: 'gpt-5.4',
              toolsUsed: ['Read', 'Edit'],
              jobCount: 1,
              hasData: true,
            },
            qualityScore: {
              score: null,
              threshold: null,
            },
            constitution: {
              overall: 81,
              principles: [
                {
                  principle: 'Security-First Design',
                  status: 'pass',
                  summary: 'No unsafe API changes.',
                },
              ],
            },
          },
        ],
        decisionPoints: [
          {
            title: 'Data fetching',
            verdict: 'AIB-401 is the cleaner approach.',
            winningTicketId: 2,
            approaches: [
              {
                ticketId: 1,
                approach: 'Manual fetch lifecycle',
                rationale: 'More code to maintain.',
              },
              {
                ticketId: 2,
                approach: 'TanStack Query',
                rationale: 'Matches existing app patterns.',
              },
            ],
          },
        ],
      },
    },
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('ComparisonViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the ranking, metrics, decision points, and constitution sections', async () => {
    renderWithProviders(
      <ComparisonViewer
        projectId={1}
        ticketId={1}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Ticket Comparison')).toBeInTheDocument();
    expect(screen.getAllByText('Winner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AIB-401').length).toBeGreaterThan(0);
    expect(screen.getByText('Ship AIB-401.')).toBeInTheDocument();

    expect(screen.getByText('Ranking')).toBeInTheDocument();
    expect(screen.getByText('Best mix of quality and speed.')).toBeInTheDocument();

    expect(screen.getByText('Metrics Comparison')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    expect(screen.getByText('Decision Points')).toBeInTheDocument();
    expect(screen.getByText('Data fetching')).toBeInTheDocument();
    expect(screen.getByText('TanStack Query')).toBeInTheDocument();

    expect(screen.getByText('Constitution Compliance')).toBeInTheDocument();
    expect(screen.getByText('Test-Driven Development')).toBeInTheDocument();
    expect(screen.getByText('Security-First Design')).toBeInTheDocument();
  });
});
