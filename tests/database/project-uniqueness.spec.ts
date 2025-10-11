import { test, expect } from '@playwright/test';
import { getPrismaClient, cleanupDatabase } from '../helpers/db-cleanup';
import { createTestProject } from '../helpers/db-setup';

/**
 * Project Uniqueness Test
 *
 * Verifies that the unique constraint on (githubOwner, githubRepo) prevents duplicate projects.
 * This ensures database integrity and prevents multiple projects for the same repository.
 *
 * Test Flow:
 * 1. Create project with (githubOwner="test", githubRepo="repo")
 * 2. Attempt to create duplicate project with same owner/repo
 * 3. Expect unique constraint error
 * 4. Verify only one project exists
 *
 * EXPECTED: Test PASSES after migration (database constraint enforced)
 */

test.describe('Project Uniqueness Constraint', () => {
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    // Cleanup after all tests
    await cleanupDatabase();
  });

  test('should prevent duplicate projects with same githubOwner and githubRepo', async () => {
    const prisma = getPrismaClient();

    // Create first project
    const project1 = await createTestProject({
      name: 'Original Project',
      description: 'First project for this repository',
      githubOwner: 'test-owner',
      githubRepo: 'test-repo',
    });

    expect(project1).toBeDefined();
    expect(project1.githubOwner).toBe('test-owner');
    expect(project1.githubRepo).toBe('test-repo');

    // Attempt to create duplicate project with same githubOwner and githubRepo
    const duplicateProjectPromise = prisma.project.create({
      data: {
        name: 'Duplicate Project',
        description: 'Attempting to create duplicate',
        githubOwner: 'test-owner', // Same as project1
        githubRepo: 'test-repo', // Same as project1
      },
    });

    // Expect unique constraint violation
    await expect(duplicateProjectPromise).rejects.toThrow();

    // Verify error is related to unique constraint
    try {
      await duplicateProjectPromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toMatch(/unique constraint|Unique constraint/i);
    }

    // Verify only one project exists
    const allProjects = await prisma.project.findMany({
      where: {
        githubOwner: 'test-owner',
        githubRepo: 'test-repo',
      },
    });

    expect(allProjects).toHaveLength(1);
    expect(allProjects[0].id).toBe(project1.id);
    expect(allProjects[0].name).toBe('Original Project');
  });

  test('should allow different projects with different repositories', async () => {
    const prisma = getPrismaClient();

    // Create first project
    const project1 = await createTestProject({
      name: 'Project 1',
      description: 'First repository',
      githubOwner: 'owner1',
      githubRepo: 'repo1',
    });

    // Create second project with different repo (should succeed)
    const project2 = await createTestProject({
      name: 'Project 2',
      description: 'Second repository',
      githubOwner: 'owner1',
      githubRepo: 'repo2', // Different repo
    });

    // Create third project with different owner (should succeed)
    const project3 = await createTestProject({
      name: 'Project 3',
      description: 'Third repository',
      githubOwner: 'owner2', // Different owner
      githubRepo: 'repo1',
    });

    // Verify all three projects were created
    const allProjects = await prisma.project.findMany({});
    expect(allProjects).toHaveLength(3);

    // Verify each project has correct data
    expect(project1.githubOwner).toBe('owner1');
    expect(project1.githubRepo).toBe('repo1');

    expect(project2.githubOwner).toBe('owner1');
    expect(project2.githubRepo).toBe('repo2');

    expect(project3.githubOwner).toBe('owner2');
    expect(project3.githubRepo).toBe('repo1');
  });

  test('should allow same repository name with different owners', async () => {
    const prisma = getPrismaClient();

    // Create project with owner1
    const project1 = await createTestProject({
      name: 'Project A',
      description: 'Owner 1 repository',
      githubOwner: 'owner1',
      githubRepo: 'shared-repo-name',
    });

    // Create project with owner2 and same repo name (should succeed)
    const project2 = await createTestProject({
      name: 'Project B',
      description: 'Owner 2 repository',
      githubOwner: 'owner2',
      githubRepo: 'shared-repo-name', // Same repo name, different owner
    });

    // Verify both projects exist
    const allProjects = await prisma.project.findMany({
      where: {
        githubRepo: 'shared-repo-name',
      },
    });

    expect(allProjects).toHaveLength(2);

    const owners = allProjects.map((p) => p.githubOwner).sort();
    expect(owners).toEqual(['owner1', 'owner2']);
  });

  test('should allow same owner with different repository names', async () => {
    const prisma = getPrismaClient();

    // Create first project for owner
    const project1 = await createTestProject({
      name: 'Project 1',
      description: 'First repository',
      githubOwner: 'shared-owner',
      githubRepo: 'repo1',
    });

    // Create second project with same owner but different repo (should succeed)
    const project2 = await createTestProject({
      name: 'Project 2',
      description: 'Second repository',
      githubOwner: 'shared-owner', // Same owner
      githubRepo: 'repo2', // Different repo
    });

    // Create third project with same owner but different repo (should succeed)
    const project3 = await createTestProject({
      name: 'Project 3',
      description: 'Third repository',
      githubOwner: 'shared-owner', // Same owner
      githubRepo: 'repo3', // Different repo
    });

    // Verify all three projects exist for the same owner
    const ownerProjects = await prisma.project.findMany({
      where: {
        githubOwner: 'shared-owner',
      },
    });

    expect(ownerProjects).toHaveLength(3);

    const repos = ownerProjects.map((p) => p.githubRepo).sort();
    expect(repos).toEqual(['repo1', 'repo2', 'repo3']);
  });

  test('should enforce uniqueness case-sensitively', async () => {
    const prisma = getPrismaClient();

    // Create project with lowercase owner/repo
    const project1 = await createTestProject({
      name: 'Lowercase Project',
      description: 'Lowercase repository',
      githubOwner: 'testowner',
      githubRepo: 'testrepo',
    });

    // Create project with different case (should succeed - case sensitive)
    const project2 = await createTestProject({
      name: 'Uppercase Project',
      description: 'Uppercase repository',
      githubOwner: 'TestOwner', // Different case
      githubRepo: 'TestRepo', // Different case
    });

    // Verify both projects exist (case-sensitive uniqueness)
    const allProjects = await prisma.project.findMany({});
    expect(allProjects.length).toBeGreaterThanOrEqual(2);

    // Verify exact case matching for retrieval
    const lowercaseProject = await prisma.project.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: 'testowner',
          githubRepo: 'testrepo',
        },
      },
    });

    const uppercaseProject = await prisma.project.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: 'TestOwner',
          githubRepo: 'TestRepo',
        },
      },
    });

    expect(lowercaseProject).toBeDefined();
    expect(uppercaseProject).toBeDefined();
    expect(lowercaseProject?.id).not.toBe(uppercaseProject?.id);
  });

  test('should use composite unique constraint for lookups', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Lookup Test Project',
      description: 'Testing composite unique constraint',
      githubOwner: 'lookup-owner',
      githubRepo: 'lookup-repo',
    });

    // Use composite unique constraint for lookup
    const foundProject = await prisma.project.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: 'lookup-owner',
          githubRepo: 'lookup-repo',
        },
      },
    });

    // Verify project found using composite constraint
    expect(foundProject).toBeDefined();
    expect(foundProject?.id).toBe(project.id);
    expect(foundProject?.name).toBe('Lookup Test Project');
    expect(foundProject?.githubOwner).toBe('lookup-owner');
    expect(foundProject?.githubRepo).toBe('lookup-repo');
  });
});
