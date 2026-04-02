/**
 * Integration Tests: DELETE /api/account
 *
 * AIB-466: Tests for account deletion endpoint.
 * Verifies authentication, cascade deletion, and proper responses.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('DELETE /api/account', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
  });

  it('should return 200 and delete user with all related data', async () => {
    const prisma = getPrismaClient();

    // Create a dedicated user for deletion (not the shared test user)
    const deleteUser = await prisma.user.create({
      data: {
        id: `delete-user-${Date.now()}`,
        email: `delete-${Date.now()}@project${ctx.projectId}.e2e.test`,
        name: 'Delete Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create related data for cascade verification
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Delete Test Project',
        key: `D${ctx.projectId}${Date.now().toString().slice(-1)}`,
        description: 'Project to be cascade-deleted',
        githubOwner: 'test-delete',
        githubRepo: `delete-repo-${Date.now()}`,
        userId: deleteUser.id,
        updatedAt: new Date(),
      },
    });

    // Delete via API (authenticated as the delete user)
    const response = await ctx.api.delete<{ message: string }>(
      '/api/account',
      { headers: { 'x-test-user-id': deleteUser.id } }
    );

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Account deleted successfully');

    // Verify cascade deletion
    const deletedUser = await prisma.user.findUnique({ where: { id: deleteUser.id } });
    expect(deletedUser).toBeNull();

    const deletedProject = await prisma.project.findUnique({ where: { id: project.id } });
    expect(deletedProject).toBeNull();
  });

  it('should return 401 for unauthenticated request', async () => {
    const response = await ctx.api.delete<{ error: string }>(
      '/api/account',
      { includeTestUserHeader: false, enableTestAuthOverride: false }
    );

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('Unauthorized');
  });
});
