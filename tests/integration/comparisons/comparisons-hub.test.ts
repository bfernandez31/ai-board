import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createProjectComparisonHubFixture } from '@/tests/helpers/comparison-fixtures';
import type { ProjectComparisonListResponse } from '@/lib/types/comparison';

describe('Comparisons hub', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('Load More accumulation (US3)', () => {
    it('supports page-by-page accumulation for infinite scroll', async () => {
      const fixture = await createProjectComparisonHubFixture(ctx.projectId);

      // First page — simulates initial load
      const page1 = await ctx.api.get<ProjectComparisonListResponse>(
        `/api/projects/${ctx.projectId}/comparisons?page=1&pageSize=1`
      );

      expect(page1.status).toBe(200);
      expect(page1.data.comparisons).toHaveLength(1);
      expect(page1.data.page).toBe(1);
      expect(page1.data.totalPages).toBe(2);
      // hasNextPage = page < totalPages
      expect(page1.data.page < page1.data.totalPages).toBe(true);

      // Second page — simulates Load More click
      const page2 = await ctx.api.get<ProjectComparisonListResponse>(
        `/api/projects/${ctx.projectId}/comparisons?page=2&pageSize=1`
      );

      expect(page2.status).toBe(200);
      expect(page2.data.comparisons).toHaveLength(1);
      expect(page2.data.page).toBe(2);
      // No more pages — Load More button should disappear
      expect(page2.data.page < page2.data.totalPages).toBe(false);

      // Verify different comparisons returned (accumulation, not replacement)
      expect(page1.data.comparisons[0]?.id).toBe(fixture.comparison.id);
      expect(page2.data.comparisons[0]?.id).toBe(fixture.olderComparison.id);
      expect(page1.data.comparisons[0]?.id).not.toBe(page2.data.comparisons[0]?.id);
    });

    it('returns winnerScore in comparison summaries', async () => {
      await createProjectComparisonHubFixture(ctx.projectId);

      const response = await ctx.api.get<ProjectComparisonListResponse>(
        `/api/projects/${ctx.projectId}/comparisons?page=1&pageSize=10`
      );

      expect(response.status).toBe(200);
      for (const comparison of response.data.comparisons) {
        expect(comparison).toHaveProperty('winnerScore');
        // winnerScore should be a number or null
        expect(
          typeof comparison.winnerScore === 'number' || comparison.winnerScore === null
        ).toBe(true);
      }
    });
  });

  describe('Deep link (US4)', () => {
    it('returns a specific comparison by ID via detail endpoint', async () => {
      const fixture = await createProjectComparisonHubFixture(ctx.projectId);
      const comparisonId = fixture.comparison.id;

      // The deep link feature uses the list endpoint to find the comparison,
      // then fetches detail when the card is expanded
      const detailResponse = await ctx.api.get<{ id: number }>(
        `/api/projects/${ctx.projectId}/comparisons/${comparisonId}`
      );

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.data.id).toBe(comparisonId);
    });

    it('returns 404 for non-existent comparison ID', async () => {
      await createProjectComparisonHubFixture(ctx.projectId);

      const response = await ctx.api.get(
        `/api/projects/${ctx.projectId}/comparisons/999999`
      );

      expect(response.status).toBe(404);
    });
  });
});
