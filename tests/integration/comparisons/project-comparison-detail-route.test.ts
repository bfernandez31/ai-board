import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createProjectComparisonHubFixture } from '@/tests/helpers/comparison-fixtures';

describe('Project comparison detail route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns structured comparison detail for a project-scoped request', async () => {
    const fixture = await createProjectComparisonHubFixture(ctx.projectId);

    const response = await ctx.api.get<{
      id: number;
      winnerTicketKey: string;
      participants: Array<{ ticketKey: string }>;
      decisionPoints: Array<{ title: string }>;
    }>(`/api/projects/${ctx.projectId}/comparisons/${fixture.comparison.id}`);

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(fixture.comparison.id);
    expect(response.data.winnerTicketKey).toBe(fixture.winnerTicket.ticketKey);
    expect(response.data.participants.map((participant) => participant.ticketKey)).toEqual([
      fixture.winnerTicket.ticketKey,
      fixture.otherTicket.ticketKey,
    ]);
    expect(response.data.decisionPoints[0]?.title).toBe('State handling');
  });

  it('returns 404 when the comparison does not belong to the project', async () => {
    await createProjectComparisonHubFixture(ctx.projectId);

    const response = await ctx.api.get<{ code: string }>(
      `/api/projects/${ctx.projectId}/comparisons/999999`
    );

    expect(response.status).toBe(404);
    expect(response.data.code).toBe('COMPARISON_NOT_FOUND');
  });
});
