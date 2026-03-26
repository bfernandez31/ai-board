import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

describe('Comparison dashboard API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns ranking, metrics, decision points, and compliance rows', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      summary: string;
      overallRecommendation: string;
      participants: Array<{
        rank: number;
        isWinner: boolean;
        scoreBand: string;
        metrics: {
          bestValueFlags: Record<string, boolean>;
        };
      }>;
      headlineMetrics: Array<{
        key: string;
        cells: Array<{ ticketKey: string; displayValue: string; isWinner: boolean }>;
      }>;
      metricMatrix: Array<{
        key: string;
        cells: Array<{ ticketKey: string; state: string; supportsPopover: boolean }>;
      }>;
      decisionPoints: Array<{
        verdictAlignment: string;
        verdictLabel: string;
        participantApproaches: Array<{ ticketKey: string }>;
      }>;
      complianceRows: Array<{
        assessments: Array<{ participantTicketKey: string; status: string }>;
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.summary).toContain('best test coverage');
    expect(response.data.overallRecommendation).toContain('TE2-102');
    expect(response.data.participants.map((participant) => participant.rank)).toEqual([1, 2]);
    expect(response.data.participants[0]).toMatchObject({
      isWinner: true,
      scoreBand: 'strong',
    });
    expect(response.data.participants[0]?.metrics.bestValueFlags.linesChanged).toBe(true);
    expect(response.data.headlineMetrics.map((row) => row.key)).toEqual([
      'costUsd',
      'durationMs',
      'qualityScore',
      'filesChanged',
    ]);
    expect(response.data.headlineMetrics[0]?.cells[0]).toMatchObject({
      ticketKey: fixture.winnerTicket.ticketKey,
      isWinner: true,
    });
    expect(response.data.metricMatrix.find((row) => row.key === 'qualityScore')?.cells[0])
      .toMatchObject({
        ticketKey: fixture.winnerTicket.ticketKey,
        supportsPopover: true,
      });
    expect(response.data.decisionPoints[0]?.participantApproaches).toHaveLength(2);
    expect(response.data.decisionPoints[0]?.verdictAlignment).toBe('supports-winner');
    expect(response.data.decisionPoints[1]?.verdictLabel).toContain('Diverges');
    expect(response.data.complianceRows[0]?.assessments.map((entry) => entry.status)).toEqual([
      'pass',
      'mixed',
    ]);
  });

  it('returns normalized neutral states for pending and missing dashboard data', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId, {
      participantCount: 4,
      pendingTelemetryTicketIndexes: [1, 3],
      missingComplianceTicketIndexes: [2],
      unavailableMetricTicketIndexes: [3],
    });

    const response = await ctx.api.get<{
      participants: Array<{ ticketKey: string }>;
      metricMatrix: Array<{
        key: string;
        cells: Array<{ ticketKey: string; state: string; displayValue: string }>;
      }>;
      complianceRows: Array<{
        assessments: Array<{ participantTicketKey: string; status: string; notes: string }>;
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.participants).toHaveLength(4);
    expect(response.data.metricMatrix.find((row) => row.key === 'totalTokens')?.cells[1])
      .toMatchObject({
        ticketKey: fixture.participantTickets[1]?.ticketKey,
        state: 'pending',
        displayValue: 'Pending',
      });
    expect(response.data.metricMatrix.find((row) => row.key === 'linesChanged')?.cells[3])
      .toMatchObject({
        ticketKey: fixture.participantTickets[3]?.ticketKey,
        state: 'unavailable',
        displayValue: 'Unavailable',
      });
    expect(response.data.complianceRows[0]?.assessments[2]).toMatchObject({
      participantTicketKey: fixture.participantTickets[2]?.ticketKey,
      status: 'missing',
      notes: 'No saved assessment for this participant.',
    });
  });
});
