import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
  getCurrentUser: vi.fn(),
  getCurrentUserOrNull: vi.fn(),
  getCurrentUserOrToken: vi.fn(),
  deleteUserAccount: vi.fn(),
  getTestUserOverrideResolution: vi.fn(),
  logBlockedTestUserOverrideAttempt: vi.fn(),
  StripeCleanupError: class extends Error {},
}));

import { getAccessibleProjectIdsForUser } from '@/lib/db/projects';

const prisma = getPrismaClient();

async function ensureUser(id: string, email: string) {
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      email,
      name: 'Accessible IDs Test',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });
}

describe('getAccessibleProjectIdsForUser', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns only projects where the user is owner or member', async () => {
    const ownerId = 'test-user-id';
    const memberOnlyId = `aid-member-${ctx.projectId}`;
    const outsiderId = `aid-outsider-${ctx.projectId}`;

    await ensureUser(memberOnlyId, `aid-member-${ctx.projectId}@e2e.test`);
    await ensureUser(outsiderId, `aid-outsider-${ctx.projectId}@e2e.test`);

    const ownedProject = await prisma.project.create({
      data: {
        key: `AO${ctx.projectId}`.slice(0, 3),
        name: '[e2e] AID owned',
        description: '[e2e] AID owned project',
        githubOwner: `aid-owned-${ctx.projectId}`,
        githubRepo: `owned-${ctx.projectId}`,
        userId: ownerId,
        updatedAt: new Date(),
      },
    });

    const memberProject = await prisma.project.create({
      data: {
        key: `AM${ctx.projectId}`.slice(0, 3),
        name: '[e2e] AID member',
        description: '[e2e] AID member project',
        githubOwner: `aid-member-${ctx.projectId}`,
        githubRepo: `member-${ctx.projectId}`,
        userId: outsiderId,
        updatedAt: new Date(),
        members: {
          create: { userId: ownerId, role: 'member' },
        },
      },
    });

    const foreignProject = await prisma.project.create({
      data: {
        key: `AF${ctx.projectId}`.slice(0, 3),
        name: '[e2e] AID foreign',
        description: '[e2e] AID foreign project',
        githubOwner: `aid-foreign-${ctx.projectId}`,
        githubRepo: `foreign-${ctx.projectId}`,
        userId: outsiderId,
        updatedAt: new Date(),
      },
    });

    const ids = await getAccessibleProjectIdsForUser(ownerId);

    expect(ids).toContain(ownedProject.id);
    expect(ids).toContain(memberProject.id);
    expect(ids).not.toContain(foreignProject.id);

    const outsiderIds = await getAccessibleProjectIdsForUser(outsiderId);
    expect(outsiderIds).toContain(memberProject.id);
    expect(outsiderIds).toContain(foreignProject.id);
    expect(outsiderIds).not.toContain(ownedProject.id);
  });

  it('returns empty array when the user has no projects or memberships', async () => {
    const lonelyId = `aid-lonely-${ctx.projectId}`;
    await ensureUser(lonelyId, `aid-lonely-${ctx.projectId}@e2e.test`);

    const ids = await getAccessibleProjectIdsForUser(lonelyId);
    expect(ids).toEqual([]);
  });
});
