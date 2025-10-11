import { test, expect } from '@playwright/test';
import { getPrismaClient } from '../../helpers/db-cleanup';
import { cleanupTestData } from '../../helpers/db-setup';
import { execSync } from 'child_process';

/**
 * Seed Idempotency Test
 *
 * Verifies that running the seed script multiple times produces the same result.
 * This ensures the seed operation is safe to run repeatedly without creating duplicates.
 *
 * Test Flow:
 * 1. Clear test database
 * 2. Run seed script (first time)
 * 3. Count projects (expect 1)
 * 4. Run seed script again (second time)
 * 5. Count projects (expect still 1, not 2)
 * 6. Verify project data unchanged
 *
 * EXPECTED: Test PASSES once seed implementation is complete with idempotency checks
 */

test.describe('Seed Idempotency', () => {
  test.beforeEach(async () => {
    // Clean database before test
    await cleanupTestData();
  });

  test.afterAll(async () => {
    // Cleanup after test
    await cleanupTestData();
  });

  test('should create project on first run and skip on subsequent runs', async () => {
    const prisma = getPrismaClient();

    // Verify database is clean
    const projectsBeforeSeed = await prisma.project.count();
    expect(projectsBeforeSeed).toBe(0);

    // Run seed script for the first time
    const seedCommand = 'npm run db:seed';
    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Seed command failed: ${error}`);
    }

    // Count projects after first seed
    const projectsAfterFirstSeed = await prisma.project.count();
    expect(projectsAfterFirstSeed).toBe(1);

    // Get the project details
    const projectAfterFirstSeed = await prisma.project.findFirst({
      where: {
        githubOwner: 'test-owner',
        githubRepo: 'test-repo',
      },
    });

    expect(projectAfterFirstSeed).toBeDefined();
    expect(projectAfterFirstSeed?.name).toBe('ai-board');
    expect(projectAfterFirstSeed?.description).toBe('AI-powered project management board');

    // Count tickets after first seed
    const ticketsAfterFirstSeed = await prisma.ticket.count({
      where: { projectId: projectAfterFirstSeed!.id },
    });
    expect(ticketsAfterFirstSeed).toBe(7); // Expected sample tickets

    // Run seed script again (second time)
    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: 'test-repo',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Second seed command failed: ${error}`);
    }

    // Count projects after second seed - should still be 1
    const projectsAfterSecondSeed = await prisma.project.count();
    expect(projectsAfterSecondSeed).toBe(1);

    // Verify the project is the same (same ID, data unchanged)
    const projectAfterSecondSeed = await prisma.project.findFirst({
      where: {
        githubOwner: 'test-owner',
        githubRepo: 'test-repo',
      },
    });

    expect(projectAfterSecondSeed?.id).toBe(projectAfterFirstSeed?.id);
    expect(projectAfterSecondSeed?.name).toBe('ai-board');
    expect(projectAfterSecondSeed?.description).toBe('AI-powered project management board');
    expect(projectAfterSecondSeed?.createdAt).toEqual(projectAfterFirstSeed?.createdAt);

    // Count tickets after second seed - should still be 7 (no duplicates)
    const ticketsAfterSecondSeed = await prisma.ticket.count({
      where: { projectId: projectAfterSecondSeed!.id },
    });
    expect(ticketsAfterSecondSeed).toBe(7);

    // Verify no duplicate projects created
    const allProjects = await prisma.project.findMany({});
    expect(allProjects).toHaveLength(1);
  });

  test('should skip creating tickets if they already exist', async () => {
    const prisma = getPrismaClient();

    // Run seed script first time
    const seedCommand = 'npm run db:seed';
    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'test-owner-2',
          GITHUB_REPO: 'test-repo-2',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Seed command failed: ${error}`);
    }

    // Verify tickets created
    const project = await prisma.project.findFirst({
      where: {
        githubOwner: 'test-owner-2',
        githubRepo: 'test-repo-2',
      },
    });
    expect(project).toBeDefined();

    const ticketsFirstRun = await prisma.ticket.count({
      where: { projectId: project!.id },
    });
    expect(ticketsFirstRun).toBe(7);

    // Run seed script again
    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'test-owner-2',
          GITHUB_REPO: 'test-repo-2',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Second seed command failed: ${error}`);
    }

    // Verify ticket count unchanged (no duplicates)
    const ticketsSecondRun = await prisma.ticket.count({
      where: { projectId: project!.id },
    });
    expect(ticketsSecondRun).toBe(7);
  });
});
