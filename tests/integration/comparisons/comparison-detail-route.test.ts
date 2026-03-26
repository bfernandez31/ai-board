import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

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
    expect(response.data.decisionPoints[0]?.title).toBe('State handling');
    expect(response.data.decisionPoints.map((point) => point.title)).toEqual([
      'State handling',
      'Fallback behavior',
    ]);
    expect(response.data.decisionPoints[0]?.verdictSummary).toBe(
      'TE2-102 handled pending states cleanly.'
    );
    expect(response.data.decisionPoints[1]?.rationale).toBe(
      'The follow-up implementation guarded sparse historical payloads.'
    );
    expect(response.data.decisionPoints[1]?.participantApproaches).toEqual([
      {
        ticketId: fixture.winnerTicket.id,
        ticketKey: fixture.winnerTicket.ticketKey!,
        summary: 'Focused on structured writes for new comparisons.',
      },
      {
        ticketId: fixture.otherTicket.id,
        ticketKey: fixture.otherTicket.ticketKey!,
        summary: 'Handled partial saved rows without crashing the detail view.',
      },
    ]);
    expect(response.data.complianceRows[0]?.principleKey).toBe(
      'typescript-first-development'
    );
  });

  it('keeps sparse historical decision points readable', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);
    const prisma = getPrismaClient();

    await prisma.decisionPointEvaluation.create({
      data: {
        comparisonRecordId: fixture.comparison.id,
        title: 'Legacy sparse row',
        verdictTicketId: null,
        verdictSummary: 'Legacy rows may omit participant approaches.',
        rationale: 'The detail route should still return the row.',
        participantApproaches: [{ summary: 'Missing keys are ignored.' }],
        displayOrder: 2,
      },
    });

    const response = await ctx.api.get<{
      decisionPoints: Array<{
        title: string;
        participantApproaches: Array<{ ticketKey: string }>;
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.decisionPoints[2]).toMatchObject({
      title: 'Legacy sparse row',
      participantApproaches: [],
    });
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
