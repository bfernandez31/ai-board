import { describe, expect, it } from 'vitest';
import { ComparisonComplianceGrid } from '@/components/comparison/comparison-compliance-grid';
import { ComparisonDecisionPoints } from '@/components/comparison/comparison-decision-points';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';

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
    quality: { state: 'available' as const, value: 92 },
    qualityBreakdown: { state: 'unavailable' as const, value: null },
    telemetry: {
      inputTokens: { state: 'available' as const, value: 100 },
      outputTokens: { state: 'available' as const, value: 50 },
      totalTokens: { state: 'available' as const, value: 150 },
      durationMs: { state: 'available' as const, value: 1000 },
      costUsd: { state: 'available' as const, value: 0.01 },
      jobCount: { state: 'available' as const, value: 1 },
      primaryModel: { state: 'available' as const, value: 'claude-sonnet-4-6' },
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
  it('renders decision points and compliance grid content', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <>
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
                { ticketId: 2, ticketKey: 'AIB-2', summary: 'Collapsed telemetry into blanks' },
              ],
            },
            {
              id: 2,
              title: 'Legacy sparse row',
              verdictTicketId: null,
              verdictSummary: 'No per-ticket summaries were saved.',
              rationale: 'Historical comparisons should keep their empty-state behavior.',
              displayOrder: 1,
              participantApproaches: [],
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
    expect(screen.getByText('Collapsed telemetry into blanks')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /legacy sparse row/i }));
    expect(
      screen.getByText('No saved participant approaches for this decision point.')
    ).toBeInTheDocument();
    expect(screen.getByText('TypeScript-First Development')).toBeInTheDocument();
    expect(screen.getByText('Strict types kept.')).toBeInTheDocument();
  });
});
