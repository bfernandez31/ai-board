import { describe, expect, it } from 'vitest';
import { ComparisonComplianceGrid } from '@/components/comparison/comparison-compliance-grid';
import { ComparisonDecisionPoints } from '@/components/comparison/comparison-decision-points';
import { ComparisonOperationalMetrics } from '@/components/comparison/comparison-operational-metrics';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

const participants = [
  {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Winner',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: null,
    rank: 1,
    score: 92,
    rankRationale: 'Best coverage',
    quality: {
      state: 'available' as const,
      score: 92,
      threshold: 'Excellent' as const,
      detailsState: 'summary_only' as const,
      details: null,
      isBest: true,
    },
    operational: {
      totalTokens: { state: 'available' as const, value: 150, isBest: true },
      inputTokens: { state: 'available' as const, value: 100, isBest: true },
      outputTokens: { state: 'available' as const, value: 50, isBest: true },
      durationMs: { state: 'available' as const, value: 1000, isBest: true },
      costUsd: { state: 'available' as const, value: 0.01, isBest: true },
      jobCount: { state: 'available' as const, value: 1, isBest: true },
      model: {
        state: 'available' as const,
        label: 'gpt-5.4',
        dominantModel: 'gpt-5.4',
        completedJobCount: 1,
        mixedModels: false,
      },
    },
    metrics: {
      linesAdded: 10,
      linesRemoved: 2,
      linesChanged: 12,
      filesChanged: 2,
      testFilesChanged: 1,
      changedFiles: [],
      bestValueFlags: {},
    },
  },
];

describe('Comparison dashboard sections', () => {
  it('renders operational metrics, decision points, and compliance grid content in sequence', () => {
    renderWithProviders(
      <>
        <ComparisonOperationalMetrics
          participants={participants}
          selectedQualityTicketId={null}
          onQualityDetailSelect={() => {}}
        />
        <ComparisonDecisionPoints
          decisionPoints={[
            {
              id: 1,
              title: 'State handling',
              verdictTicketId: 1,
              verdictSummary: 'AIB-1 handled pending state better.',
              rationale: 'Explicit states were preserved.',
              displayOrder: 0,
              participantApproaches: [
                { ticketId: 1, ticketKey: 'AIB-1', summary: 'Explicit pending state' },
              ],
            },
          ]}
        />
        <ComparisonComplianceGrid
          rows={[
            {
              principleKey: 'typescript-first-development',
              principleName: 'TypeScript-First Development',
              displayOrder: 0,
              assessments: [
                {
                  participantTicketId: 1,
                  participantTicketKey: 'AIB-1',
                  status: 'pass',
                  notes: 'Strict types kept.',
                },
              ],
            },
          ]}
          participants={participants}
        />
      </>
    );

    expect(screen.getByText('State handling')).toBeInTheDocument();
    expect(screen.getByText('AIB-1 handled pending state better.')).toBeInTheDocument();
    expect(screen.getByText('TypeScript-First Development')).toBeInTheDocument();
    expect(screen.getByText('Strict types kept.')).toBeInTheDocument();
    expect(screen.getByText('Operational Metrics')).toBeInTheDocument();
  });
});
