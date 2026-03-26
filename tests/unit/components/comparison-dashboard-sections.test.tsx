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
    scoreBand: 'strong' as const,
    isWinner: true,
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
  {
    ticketId: 2,
    ticketKey: 'AIB-2',
    title: 'Runner up',
    stage: 'PLAN' as const,
    workflowType: 'QUICK' as const,
    agent: null,
    rank: 2,
    score: 74,
    scoreBand: 'moderate' as const,
    isWinner: false,
    rankRationale: 'Good but less complete',
    quality: { state: 'pending' as const, value: null },
    qualityBreakdown: { state: 'unavailable' as const, value: null },
    telemetry: {
      inputTokens: { state: 'pending' as const, value: null },
      outputTokens: { state: 'pending' as const, value: null },
      totalTokens: { state: 'pending' as const, value: null },
      durationMs: { state: 'pending' as const, value: null },
      costUsd: { state: 'pending' as const, value: null },
      jobCount: { state: 'pending' as const, value: null },
      primaryModel: { state: 'pending' as const, value: null },
    },
    metrics: {
      linesAdded: 30,
      linesRemoved: 10,
      linesChanged: 40,
      filesChanged: 4,
      testFilesChanged: 0,
      changedFiles: [],
      bestValueFlags: {},
    },
  },
];

describe('Comparison dashboard sections', () => {
  it('renders verdict-first decision triggers and default-open content', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ComparisonDecisionPoints
        decisionPoints={[
          {
            id: 1,
            title: 'State handling',
            verdictTicketId: 1,
            verdictLabel: 'Supports AIB-1',
            verdictAlignment: 'supports-winner',
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
            title: 'Fallback behavior',
            verdictTicketId: 2,
            verdictLabel: 'Diverges from winner',
            verdictAlignment: 'diverges-from-winner',
            verdictSummary: 'AIB-2 guarded legacy sparse rows.',
            rationale: 'Historical comparisons should keep their empty-state behavior.',
            displayOrder: 1,
            participantApproaches: [],
          },
        ]}
      />
    );

    expect(screen.getByText('Supports AIB-1')).toBeInTheDocument();
    expect(screen.getByText('Explicit pending state')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /fallback behavior/i }));
    expect(
      screen.getByText('No saved participant approaches for this decision point.')
    ).toBeInTheDocument();
  });

  it('renders pass, mixed, fail, and missing compliance states with notes', () => {
    renderWithProviders(
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
              {
                participantTicketId: 2,
                participantTicketKey: 'AIB-2',
                status: 'mixed',
                notes: 'Some typing gaps remain.',
              },
            ],
          },
          {
            principleKey: 'security-first-design',
            principleName: 'Security-First Design',
            displayOrder: 1,
            assessments: [
              {
                participantTicketId: 1,
                participantTicketKey: 'AIB-1',
                status: 'fail',
                notes: 'Missed an auth guard.',
              },
              {
                participantTicketId: 2,
                participantTicketKey: 'AIB-2',
                status: 'missing',
                notes: 'No saved assessment for this participant.',
              },
            ],
          },
        ]}
        participants={participants}
      />
    );

    expect(screen.getByText('TypeScript-First Development')).toBeInTheDocument();
    expect(screen.getByText('Security-First Design')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.getByText('Mixed')).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('No saved assessment for this participant.')).toBeInTheDocument();
  });
});
