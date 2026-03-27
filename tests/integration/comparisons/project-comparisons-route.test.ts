import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createProjectComparisonHubFixture } from '@/tests/helpers/comparison-fixtures';

describe('Project comparisons route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns newest-first paginated project comparison summaries', async () => {
    const fixture = await createProjectComparisonHubFixture(ctx.projectId);

    const response = await ctx.api.get<{
      comparisons: Array<{ id: number; winnerTicketKey: string; winnerTicketTitle: string }>;
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>(`/api/projects/${ctx.projectId}/comparisons?page=1&pageSize=1`);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(response.data.comparisons[0]).toMatchObject({
      id: fixture.comparison.id,
      winnerTicketKey: fixture.winnerTicket.ticketKey,
      winnerTicketTitle: fixture.winnerTicket.title,
    });

    const secondPage = await ctx.api.get<{
      comparisons: Array<{ id: number }>;
    }>(`/api/projects/${ctx.projectId}/comparisons?page=2&pageSize=1`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.data.comparisons[0]?.id).toBe(fixture.olderComparison.id);
  });

  it('returns an empty paginated payload when a project has no saved comparisons', async () => {
    const response = await ctx.api.get<{
      comparisons: unknown[];
      total: number;
      totalPages: number;
    }>(`/api/projects/${ctx.projectId}/comparisons?page=1&pageSize=10`);

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      comparisons: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });
});
