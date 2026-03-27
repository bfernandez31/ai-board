import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

describe('Comparisons Hub API - GET /api/projects/:projectId/comparisons', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns DB-backed comparison summaries with ProjectComparisonSummary shape', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      comparisons: Array<{
        id: number;
        generatedAt: string;
        sourceTicketKey: string;
        sourceTicketTitle: string;
        winnerTicketKey: string;
        winnerTicketTitle: string;
        winnerScore: number;
        participantCount: number;
        participantTicketKeys: string[];
        summary: string;
        keyDifferentiators: string[];
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/api/projects/${ctx.projectId}/comparisons`);

    expect(response.status).toBe(200);
    expect(response.data.total).toBe(1);
    expect(response.data.limit).toBe(20);
    expect(response.data.offset).toBe(0);
    expect(response.data.comparisons).toHaveLength(1);

    const comparison = response.data.comparisons[0]!;
    expect(comparison.id).toBe(fixture.comparison.id);
    expect(comparison.sourceTicketKey).toBe('TE2-101');
    expect(comparison.winnerTicketKey).toBe('TE2-102');
    expect(comparison.winnerScore).toBe(91);
    expect(comparison.participantCount).toBe(2);
    expect(comparison.participantTicketKeys).toContain('TE2-102');
    expect(comparison.participantTicketKeys).toContain('TE2-103');
    expect(comparison.summary).toBeTruthy();
    expect(Array.isArray(comparison.keyDifferentiators)).toBe(true);
    expect(comparison.generatedAt).toBeTruthy();
  });

  it('returns empty list for project with no comparisons', async () => {
    const response = await ctx.api.get<{
      comparisons: unknown[];
      total: number;
    }>(`/api/projects/${ctx.projectId}/comparisons`);

    expect(response.status).toBe(200);
    expect(response.data.comparisons).toHaveLength(0);
    expect(response.data.total).toBe(0);
  });

  it('supports limit and offset pagination', async () => {
    await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      comparisons: unknown[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/projects/${ctx.projectId}/comparisons?limit=1&offset=0`);

    expect(response.status).toBe(200);
    expect(response.data.limit).toBe(1);
    expect(response.data.offset).toBe(0);
    expect(response.data.comparisons).toHaveLength(1);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await ctx.api.get<{ error: string }>(
      '/api/projects/invalid/comparisons'
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('Invalid project ID');
  });

  it('returns 401 for unauthorized user', async () => {
    const response = await ctx.api.get<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      { includeTestUserHeader: false, enableTestAuthOverride: false }
    );

    expect(response.status).toBe(401);
  });
});
