/**
 * Integration Tests: Config Sync (staleness + auto-refresh logic)
 *
 * Tests the config sync module's DB operations and staleness detection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import {
  isConfigStale,
  syncProjectConfigAfterSetupCompletion,
} from '@/lib/config-sync';

describe('Config Sync - Staleness and Auto-Refresh', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('isConfigStale', () => {
    it('returns true when configSyncedAt is null', () => {
      expect(isConfigStale({ configSyncedAt: null })).toBe(true);
    });

    it('returns true when config is older than 1 hour', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(isConfigStale({ configSyncedAt: twoHoursAgo })).toBe(true);
    });

    it('returns false when config is less than 1 hour old', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      expect(isConfigStale({ configSyncedAt: thirtyMinAgo })).toBe(false);
    });

    it('returns false when config was just synced', () => {
      expect(isConfigStale({ configSyncedAt: new Date() })).toBe(false);
    });
  });

  describe('Config fields in database', () => {
    it('stores config JSON and syncedAt timestamp', async () => {
      const testConfig = {
        version: 1,
        project: { name: 'test', language: 'typescript', framework: 'nextjs' },
        runtime: { manager: 'bun' },
        services: [{ type: 'postgres', version: '14' }],
        commands: { install: 'bun install' },
        agent: { cli: 'claude-code' },
      };
      const now = new Date();

      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { config: testConfig, configSyncedAt: now },
      });

      const project = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { config: true, configSyncedAt: true },
      });

      expect(project?.config).toEqual(testConfig);
      expect(project?.configSyncedAt).toEqual(now);
    });

    it('defaults config and configSyncedAt to null', async () => {
      // Reset to null
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { config: null, configSyncedAt: null },
      });

      const project = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { config: true, configSyncedAt: true },
      });

      expect(project?.config).toBeNull();
      expect(project?.configSyncedAt).toBeNull();
    });
  });

  describe('POST /api/projects/:projectId/config/sync', () => {
    it('returns 401 when not authenticated', async () => {
      const response = await fetch(
        `${process.env.TEST_BASE_URL || 'http://localhost:3000'}/api/projects/${ctx.projectId}/config/sync`,
        { method: 'POST' }
      );
      expect(response.status).toBe(401);
    });

    it('returns 404 for non-existent project', async () => {
      const response = await ctx.api.post('/api/projects/999999/config/sync', {});
      expect(response.status).toBe(404);
    });

    it('syncs config after setup completion in test mode', async () => {
      const result = await syncProjectConfigAfterSetupCompletion({
        id: ctx.projectId,
        githubOwner: 'test',
        githubRepo: 'test',
        configSyncedAt: null,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const project = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { config: true, configSyncedAt: true },
      });

      expect(project?.config).not.toBeNull();
      expect(project?.configSyncedAt).not.toBeNull();
    });
  });

  describe('Service credential stripping', () => {
    it('stored config does not contain username or password in services', async () => {
      const configWithCredentials = {
        version: 1,
        project: { name: 'test', language: 'typescript', framework: 'nextjs' },
        runtime: { manager: 'bun' },
        services: [
          { type: 'postgres', version: '14', database: 'mydb', username: 'admin', password: 'secret' },
          { type: 'redis', version: '7' },
        ],
        commands: { install: 'bun install' },
        agent: { cli: 'claude-code' },
      };

      // Simulate what config-sync does: validate, strip credentials, strip env, store
      const { validateConfig, stripServiceCredentials } = await import('@/lib/validations/config');
      const validation = validateConfig(configWithCredentials);
      expect(validation.success).toBe(true);
      if (!validation.success) return;

      const stripped = stripServiceCredentials(validation.data);
      const { env: _env, ...configToStore } = stripped;

      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { config: configToStore, configSyncedAt: new Date() },
      });

      const project = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { config: true },
      });

      const storedConfig = project?.config as Record<string, unknown>;
      const services = storedConfig.services as Record<string, unknown>[];
      for (const service of services) {
        expect(service).not.toHaveProperty('username');
        expect(service).not.toHaveProperty('password');
      }
      expect(services[0]).toEqual({ type: 'postgres', version: '14', database: 'mydb' });
      expect(services[1]).toEqual({ type: 'redis', version: '7' });
    });
  });
});
