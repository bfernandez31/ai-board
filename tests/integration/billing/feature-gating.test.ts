import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Feature Gating', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any subscriptions
    const user = await prisma.user.findFirst({ where: { email: 'test@e2e.local' } });
    if (user) {
      await prisma.subscription.deleteMany({ where: { userId: user.id } });
    }
  });

  describe('Project creation limit (Free plan = 1)', () => {
    it('should allow creating first project on Free plan', async () => {
      // The test context already has a project, so this verifies the project exists
      const response = await ctx.api.get<Array<{ id: number }>>('/api/projects');
      expect(response.status).toBe(200);
    });

    it('should enforce maxProjects limit for Free plan users', async () => {
      // Free plan users already have their test project
      // Creating a second should be blocked with 403
      const response = await ctx.api.post<{ error: string; code?: string }>('/api/projects', {
        name: '[e2e] Second Project',
        description: 'Should be blocked',
        githubOwner: 'test-owner',
        githubRepo: 'test-repo-second',
      });

      expect(response.status).toBe(403);
      expect(response.data.error).toContain('Project limit reached');
    });
  });

  describe('Ticket creation limit (Free plan = 5/month)', () => {
    it('should allow creating tickets within Free plan limit', async () => {
      const response = await ctx.api.post<{ id: number }>(`/api/projects/${ctx.projectId}/tickets`, {
        title: '[e2e] Test Ticket Gating',
        description: 'Testing ticket creation within limits',
      });

      expect(response.status).toBe(201);
    });

    it('should enforce maxTicketsPerMonth limit for Free plan users', async () => {
      // Create 5 tickets to hit the limit
      for (let i = 0; i < 5; i++) {
        await ctx.createTicket({ title: `[e2e] Gating Ticket ${i + 1}` });
      }

      // 6th ticket should be blocked
      const response = await ctx.api.post<{ error: string; code?: string }>(`/api/projects/${ctx.projectId}/tickets`, {
        title: '[e2e] Over Limit Ticket',
        description: 'Should be blocked',
      });

      expect(response.status).toBe(403);
      expect(response.data.error).toContain('Monthly ticket limit reached');
      expect(response.data.code).toBe('PLAN_LIMIT');
    });
  });

  describe('Member addition gating', () => {
    it('should block adding members on Free plan', async () => {
      const response = await ctx.api.post<{ error: string; code?: string }>(
        `/api/projects/${ctx.projectId}/members`,
        { email: 'member@e2e.local' }
      );

      expect(response.status).toBe(403);
      expect(response.data.error).toContain('Team plan');
      expect(response.data.code).toBe('PLAN_LIMIT');
    });
  });
});
