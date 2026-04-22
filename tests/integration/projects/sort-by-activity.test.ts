/**
 * Integration tests: GET /api/projects sorted by activity (AIB-713).
 *
 * Projects on the projects page should be ordered from most to least
 * active. Activity = MAX(project.updatedAt, latest ticket.updatedAt,
 * latest job.startedAt).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

interface ProjectResponseItem {
  id: number;
  updatedAt: string;
  lastActivityAt: string;
}

describe('GET /api/projects — activity-based sorting (AIB-713)', () => {
  let ctx: TestContext;
  const createdProjectIds: number[] = [];

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    createdProjectIds.length = 0;
  });

  afterEach(async () => {
    if (createdProjectIds.length === 0) return;
    const prisma = getPrismaClient();
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  });

  it('includes a lastActivityAt ISO timestamp on every project', async () => {
    const response = await ctx.api.get<ProjectResponseItem[]>('/api/projects');

    expect(response.status).toBe(200);
    expect(response.data.length).toBeGreaterThan(0);

    for (const project of response.data) {
      expect(project).toHaveProperty('lastActivityAt');
      expect(typeof project.lastActivityAt).toBe('string');
      // Valid ISO 8601 timestamp
      expect(Number.isNaN(new Date(project.lastActivityAt).getTime())).toBe(false);
      // lastActivityAt is always >= updatedAt (project.updatedAt is one of the inputs to MAX)
      expect(new Date(project.lastActivityAt).getTime()).toBeGreaterThanOrEqual(
        new Date(project.updatedAt).getTime(),
      );
    }
  });

  it('moves a project higher in the list when one of its tickets is recently updated', async () => {
    const prisma = getPrismaClient();

    // Create two fresh projects owned by the test user, with stale timestamps.
    const staleDate = new Date('2020-01-01T00:00:00Z');
    const ownerId = 'test-user-id';
    const unique = Date.now();

    const projectA = await prisma.project.create({
      data: {
        name: `[e2e] activity-sort-A-${unique}`,
        description: 'A',
        githubOwner: 'test',
        githubRepo: `activity-sort-a-${unique}`,
        key: `AA${(unique % 10).toString()}`.substring(0, 3),
        userId: ownerId,
        createdAt: staleDate,
        updatedAt: staleDate,
      },
    });
    createdProjectIds.push(projectA.id);

    const projectB = await prisma.project.create({
      data: {
        name: `[e2e] activity-sort-B-${unique}`,
        description: 'B',
        githubOwner: 'test',
        githubRepo: `activity-sort-b-${unique}`,
        key: `BB${(unique % 10).toString()}`.substring(0, 3),
        userId: ownerId,
        createdAt: staleDate,
        updatedAt: staleDate,
      },
    });
    createdProjectIds.push(projectB.id);

    // Give project A a very recent ticket update (bumps its activity signal).
    await prisma.ticket.create({
      data: {
        projectId: projectA.id,
        ticketNumber: 1,
        ticketKey: `ACT-${unique}`,
        title: '[e2e] Recent activity',
        description: 'x',
        stage: 'BUILD',
        updatedAt: new Date(),
      },
    });

    const response = await ctx.api.get<ProjectResponseItem[]>('/api/projects');
    expect(response.status).toBe(200);

    const indexA = response.data.findIndex((p) => p.id === projectA.id);
    const indexB = response.data.findIndex((p) => p.id === projectB.id);
    expect(indexA).toBeGreaterThanOrEqual(0);
    expect(indexB).toBeGreaterThanOrEqual(0);

    // A has recent ticket activity, B has none — A must rank higher (lower index).
    expect(indexA).toBeLessThan(indexB);

    // lastActivityAt reflects the ticket update, not the stale project.updatedAt.
    const projectAResp = response.data[indexA]!;
    expect(new Date(projectAResp.lastActivityAt).getTime()).toBeGreaterThan(
      new Date('2021-01-01T00:00:00Z').getTime(),
    );
  });

  it('returns the list in non-increasing lastActivityAt order', async () => {
    const response = await ctx.api.get<ProjectResponseItem[]>('/api/projects');
    expect(response.status).toBe(200);

    const timestamps = response.data.map((p) => new Date(p.lastActivityAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]!);
    }
  });
});
