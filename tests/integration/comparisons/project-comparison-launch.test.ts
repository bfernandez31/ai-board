import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createProjectComparisonHubFixture } from '@/tests/helpers/comparison-fixtures';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Project comparison launch route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('creates the comment and job records for a hub-launched comparison', async () => {
    const fixture = await createProjectComparisonHubFixture(ctx.projectId);
    const prisma = getPrismaClient();

    const response = await ctx.api.post<{
      jobId: number;
      commentId: number;
      sourceTicketKey: string;
      selectedTicketKeys: string[];
      status: string;
      commentContent: string;
    }>(`/api/projects/${ctx.projectId}/comparisons/launch`, {
      ticketIds: [fixture.winnerTicket.id, fixture.verifyCandidate.id],
    });

    expect(response.status).toBe(202);
    expect(response.data.status).toBe('PENDING');
    expect(response.data.selectedTicketKeys).toEqual(
      expect.arrayContaining([
        fixture.winnerTicket.ticketKey!,
        fixture.verifyCandidate.ticketKey!,
      ])
    );
    expect(response.data.commentContent).toContain('/compare');

    const createdComment = await prisma.comment.findUnique({
      where: { id: response.data.commentId },
    });
    const createdJob = await prisma.job.findUnique({
      where: { id: response.data.jobId },
    });

    expect(createdComment?.content).toContain('#');
    expect(createdJob).toMatchObject({
      projectId: ctx.projectId,
      command: 'comment-verify',
      status: 'PENDING',
    });
  });

  it('rejects launches that include non-VERIFY tickets', async () => {
    const fixture = await createProjectComparisonHubFixture(ctx.projectId);

    const response = await ctx.api.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/comparisons/launch`,
      {
        ticketIds: [fixture.sourceTicket.id, fixture.verifyCandidate.id],
      }
    );

    expect(response.status).toBe(409);
    expect(response.data.code).toBe('INVALID_STAGE');
  });
});
