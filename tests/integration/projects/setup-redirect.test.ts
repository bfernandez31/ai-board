/**
 * Integration Tests: Setup Redirect Logic
 *
 * Tests that the board page redirects to setup when unconfigured,
 * and the setup page redirects to board when configured.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Setup Redirect Logic', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Clean up any setup jobs
    const prisma = getPrismaClient();
    await prisma.projectSetupJob.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  describe('Board → Setup redirect', () => {
    it('should redirect to setup when project is unconfigured', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: null },
      });

      const response = await ctx.api.fetch(`/projects/${ctx.projectId}/board`, {
        redirect: 'manual',
      });

      // Next.js redirect returns 307
      expect([302, 303, 307, 308]).toContain(response.status);
      const location = response.headers.get('location');
      expect(location).toContain(`/projects/${ctx.projectId}/setup`);
    });

    it('should NOT redirect when project is configured', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date() },
      });

      const response = await ctx.api.fetch(`/projects/${ctx.projectId}/board`, {
        redirect: 'manual',
      });

      // Should render the board (200) or not redirect to setup
      const location = response.headers.get('location');
      if (location) {
        expect(location).not.toContain('/setup');
      } else {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Setup → Board redirect', () => {
    it('should redirect to board when project is already configured', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date() },
      });

      const response = await ctx.api.fetch(`/projects/${ctx.projectId}/setup`, {
        redirect: 'manual',
      });

      expect([302, 303, 307, 308]).toContain(response.status);
      const location = response.headers.get('location');
      expect(location).toContain(`/projects/${ctx.projectId}/board`);
    });
  });
});
