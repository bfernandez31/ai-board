import { describe, expect, it } from 'vitest';
import { ComparisonComplianceGrid } from '@/components/comparison/comparison-compliance-grid';
import { ComparisonDecisionPoints } from '@/components/comparison/comparison-decision-points';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';

const participants = [
  {
    ticketId: 1,
    ticketKey: 'AIB-1',
    title: 'Winner',
    stage: 'VERIFY' as const,
    workflowType: 'FULL' as const,
    agent: 'CODEX',
    rank: 1,
    score: 92,
    rankRationale: 'Best coverage',
    quality: {
      state: 'available' as const,
      value: 92,
      threshold: 'Excellent' as const,
      details: {
        dimensions: [
          {
            name: 'Compliance',
            agentId: 'compliance',
            score: 95,
            weight: 0.4,
            weightedScore: 38,
          },
          {
            name: 'Bug Detection',
            agentId: 'bug-detection',
            score: 90,
            weight: 0.3,
            weightedScore: 27,
          },
          {
            name: 'Code Comments',
            agentId: 'code-comments',
            score: 88,
            weight: 0.2,
            weightedScore: 17.6,
          },
          {
            name: 'Historical Context',
            agentId: 'historical-context',
            score: 84,
            weight: 0.1,
            weightedScore: 8.4,
          },
          {
            name: 'Spec Sync',
            agentId: 'spec-sync',
            score: 80,
            weight: 0,
            weightedScore: 0,
          },
        ],
        threshold: 'Excellent' as const,
        computedAt: '2026-03-20T00:00:00.000Z',
      },
    },
    telemetry: {
      totalTokens: { state: 'available' as const, value: 150 },
      inputTokens: { state: 'available' as const, value: 100 },
      outputTokens: { state: 'available' as const, value: 50 },
      durationMs: { state: 'available' as const, value: 1000 },
      costUsd: { state: 'available' as const, value: 0.01 },
      jobCount: { state: 'available' as const, value: 2 },
      primaryModel: { state: 'available' as const, value: 'gpt-5.4' },
      bestValueFlags: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
        jobCount: true,
        quality: true,
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
  it('renders decision points and compliance grid content', () => {
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
  });
});
