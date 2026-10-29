/**
 * Integration Tests: PROJECT_CREATION_DISABLED guard on
 * POST /api/projects and POST /api/projects/import.
 *
 * Calls the route handlers in-process so the env flag can be toggled per test
 * (the shared dev server would not see it). The authenticated user is mocked
 * to control whether the caller is in ADMIN_ALLOWLIST.
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getTestUserId } from '@/tests/helpers/db-cleanup';

const ADMIN_EMAIL = 'admin@e2e.local';
const NON_ADMIN_EMAIL = 'test@e2e.local';
const PROJECT_NAME = '[e2e] creation-gate';

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/users')>()),
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/config-sync', () => ({
  syncProjectConfig: vi.fn(async () => ({ success: false })),
}));

import { POST as createProject } from '@/app/api/projects/route';
import { POST as importProject } from '@/app/api/projects/import/route';

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const createBody = {
  name: PROJECT_NAME,
  description: 'Should be blocked by the creation gate',
  githubOwner: 'test-owner',
  githubRepo: 'creation-gate-repo',
};

const importBody = { githubOwner: 'octocat', githubRepo: 'creation-gate-repo' };

describe('Project creation gate (PROJECT_CREATION_DISABLED)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const originalDisabled = process.env.PROJECT_CREATION_DISABLED;
  const originalAllowlist = process.env.ADMIN_ALLOWLIST;

  async function signInAs(email: string) {
    mockGetCurrentUser.mockResolvedValue({
      id: await getTestUserId(),
      email,
      source: 'test-override',
    });
  }

  async function countGateProjects() {
    return prisma.project.count({ where: { name: PROJECT_NAME } });
  }

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    process.env.PROJECT_CREATION_DISABLED = 'true';
    process.env.ADMIN_ALLOWLIST = ADMIN_EMAIL;
  });

  afterEach(async () => {
    await prisma.project.deleteMany({ where: { name: PROJECT_NAME } });
    if (originalDisabled === undefined) delete process.env.PROJECT_CREATION_DISABLED;
    else process.env.PROJECT_CREATION_DISABLED = originalDisabled;
    if (originalAllowlist === undefined) delete process.env.ADMIN_ALLOWLIST;
    else process.env.ADMIN_ALLOWLIST = originalAllowlist;
  });

  describe('POST /api/projects', () => {
    it('returns 403 PROJECT_CREATION_DISABLED for non-admins and creates nothing', async () => {
      await signInAs(NON_ADMIN_EMAIL);

      const response = await createProject(jsonRequest('/api/projects', createBody));

      expect(response.status).toBe(403);
      expect(await response.json()).toHaveProperty('code', 'PROJECT_CREATION_DISABLED');
      expect(await countGateProjects()).toBe(0);
    });

    it('lets admins past the gate', async () => {
      await signInAs(ADMIN_EMAIL);

      const response = await createProject(jsonRequest('/api/projects', createBody));
      const body = await response.json();

      expect(body.code).not.toBe('PROJECT_CREATION_DISABLED');
    });
  });

  describe('POST /api/projects/import', () => {
    it('returns 403 PROJECT_CREATION_DISABLED for non-admins before the GitHub scope check', async () => {
      await signInAs(NON_ADMIN_EMAIL);

      const response = await importProject(jsonRequest('/api/projects/import', importBody));

      expect(response.status).toBe(403);
      expect(await response.json()).toHaveProperty('code', 'PROJECT_CREATION_DISABLED');
      expect(await countGateProjects()).toBe(0);
    });

    it('lets admins past the gate (reaches the GitHub scope check)', async () => {
      await signInAs(ADMIN_EMAIL);

      const response = await importProject(jsonRequest('/api/projects/import', importBody));

      expect(response.status).toBe(403);
      expect(await response.json()).toHaveProperty('code', 'MISSING_SCOPE');
    });
  });
});
