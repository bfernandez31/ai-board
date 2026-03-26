import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

describe('Comparison detail route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns structured detail payload for a participating ticket', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      id: number;
      winnerTicketKey: string;
      participants: Array<{
        ticketKey: string;
        quality: { state: string; value: number | null };
        telemetry: {
          inputTokens: { state: string; value: number | null };
        };
      }>;
      decisionPoints: Array<{
        title: string;
        verdictSummary: string;
        rationale: string;
        participantApproaches: Array<{ ticketKey: string; summary: string }>;
      }>;
      complianceRows: Array<{ principleKey: string }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.otherTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(fixture.comparison.id);
    expect(response.data.winnerTicketKey).toBe(fixture.winnerTicket.ticketKey);
    expect(response.data.participants[0]?.quality).toEqual({
      state: 'available',
      value: 91,
    });
    // otherTicket has a COMPLETED job with null tokens — aggregated to 0 (available)
    expect(response.data.participants[1]?.telemetry.inputTokens).toEqual({
      state: 'available',
      value: 0,
    });
    expect(response.data.decisionPoints[0]).toMatchObject({
      title: 'State handling',
      verdictSummary: 'TE2-102 handled pending states cleanly.',
      rationale: 'The winner kept unavailable telemetry explicit.',
      participantApproaches: [
        {
          ticketKey: fixture.winnerTicket.ticketKey ?? 'TE2-102',
          summary: 'Used explicit pending/unavailable states.',
        },
        {
          ticketKey: fixture.otherTicket.ticketKey ?? 'TE2-103',
          summary: 'Collapsed missing data into empty strings.',
        },
      ],
    });
    expect(response.data.complianceRows[0]?.principleKey).toBe(
      'typescript-first-development'
    );
  });

  it('returns 404 when the ticket is not a participant in the comparison', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);
    const unrelated = await ctx.createTicket({
      title: '[e2e] Unrelated ticket',
      description: 'Does not participate',
    });

    const response = await ctx.api.get<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${unrelated.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(404);
    expect(response.data.code).toBe('COMPARISON_NOT_FOUND');
  });
});
