import { test, expect } from '../helpers/worker-isolation';
import { getPrismaClient } from '../helpers/db-cleanup';
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

// Helper: Generate unique ID for multi-worker isolation
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Helper: Generate unique 3-character key (random alphanumeric)
const uniqueKey = () => {
  // Generate 3 random uppercase alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

test.describe('Project Uniqueness Constraint', () => {
  test.beforeEach(async () => {
    // Tests create their own projects with unique owner/repo combinations
    // No cleanup needed - tests are isolated by unique githubOwner/githubRepo
  });

  test('should prevent duplicate projects with same githubOwner and githubRepo', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();
    // Create first project
    const project1 = await createTestProject({
      name: 'Original Project',
      description: 'First project for this repository',
      githubOwner: `test-owner-${id}`,
      githubRepo: `test-repo-${id}`,
      key: uniqueKey(),
    });

    expect(project1).toBeDefined();
    expect(project1.githubOwner).toBe(`test-owner-${id}`);
    expect(project1.githubRepo).toBe(`test-repo-${id}`);

    // Ensure test user exists for duplicate attempt
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    // Attempt to create duplicate project with same githubOwner and githubRepo
    const duplicateProjectPromise = prisma.project.create({
      data: {
        name: 'Duplicate Project',
        description: 'Attempting to create duplicate',
        githubOwner: `test-owner-${id}`, // Same as project1
        githubRepo: `test-repo-${id}`, // Same as project1
        key: 'DUP',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
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
        githubOwner: `test-owner-${id}`,
        githubRepo: `test-repo-${id}`,
      },
    });

    expect(allProjects).toHaveLength(1);
    expect(allProjects[0]!.id).toBe(project1.id);
    expect(allProjects[0]!.name).toBe('[e2e] Original Project');
  });

  test('should allow different projects with different repositories', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();
    // Create first project
    const project1 = await createTestProject({
      name: 'Project 1',
      description: 'First repository',
      githubOwner: `owner1-${id}`,
      githubRepo: `repo1-${id}`,
      key: uniqueKey(),
    });

    // Create second project with different repo (should succeed)
    const project2 = await createTestProject({
      name: 'Project 2',
      description: 'Second repository',
      githubOwner: `owner1-${id}`,
      githubRepo: `repo2-${id}`, // Different repo
      key: uniqueKey(),
    });

    // Create third project with different owner (should succeed)
    const project3 = await createTestProject({
      name: 'Project 3',
      description: 'Third repository',
      githubOwner: `owner2-${id}`, // Different owner
      githubRepo: `repo1-${id}`,
      key: uniqueKey(),
    });

    // Verify all three test projects were created (may be more if other projects exist)
    const allProjects = await prisma.project.findMany({});
    expect(allProjects.length).toBeGreaterThanOrEqual(3);

    // Verify each project has correct data
    expect(project1.githubOwner).toBe(`owner1-${id}`);
    expect(project1.githubRepo).toBe(`repo1-${id}`);

    expect(project2.githubOwner).toBe(`owner1-${id}`);
    expect(project2.githubRepo).toBe(`repo2-${id}`);

    expect(project3.githubOwner).toBe(`owner2-${id}`);
    expect(project3.githubRepo).toBe(`repo1-${id}`);
  });

  test('should allow same repository name with different owners', async () => {
    const id = uniqueId();
    const prisma = getPrismaClient();

    // Create project with owner1
    await createTestProject({
      name: 'Project A',
      description: 'Owner 1 repository',
      githubOwner: `owner1-${id}`,
      githubRepo: `shared-repo-name-${id}`,
      key: uniqueKey(),
    });

    // Create project with owner2 and same repo name (should succeed)
    await createTestProject({
      name: 'Project B',
      description: 'Owner 2 repository',
      githubOwner: `owner2-${id}`,
      githubRepo: `shared-repo-name-${id}`, // Same repo name, different owner
      key: uniqueKey(),
    });

    // Verify both projects exist
    const allProjects = await prisma.project.findMany({
      where: {
        githubRepo: `shared-repo-name-${id}`,
      },
    });

    expect(allProjects).toHaveLength(2);

    const owners = allProjects.map((p) => p.githubOwner).sort();
    expect(owners).toEqual([`owner1-${id}`, `owner2-${id}`]);
  });

  test('should allow same owner with different repository names', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();

    // Create first project for owner
    await createTestProject({
      name: 'Project 1',
      description: 'First repository',
      githubOwner: `shared-owner-${id}`,
      githubRepo: `repo1-${id}`,
      key: uniqueKey(),
    });

    // Create second project with same owner but different repo (should succeed)
    await createTestProject({
      name: 'Project 2',
      description: 'Second repository',
      githubOwner: `shared-owner-${id}`, // Same owner
      githubRepo: `repo2-${id}`, // Different repo
      key: uniqueKey(),
    });

    // Create third project with same owner but different repo (should succeed)
    await createTestProject({
      name: 'Project 3',
      description: 'Third repository',
      githubOwner: `shared-owner-${id}`, // Same owner
      githubRepo: `repo3-${id}`, // Different repo
      key: uniqueKey(),
    });

    // Verify all three projects exist for the same owner
    const ownerProjects = await prisma.project.findMany({
      where: {
        githubOwner: `shared-owner-${id}`,
      },
    });

    expect(ownerProjects).toHaveLength(3);

    const repos = ownerProjects.map((p) => p.githubRepo).sort();
    expect(repos).toEqual([`repo1-${id}`, `repo2-${id}`, `repo3-${id}`]);
  });

  test('should enforce uniqueness case-sensitively', async () => {
    const prisma = getPrismaClient();
    const id = uniqueId();

    // Create project with lowercase owner/repo
    await createTestProject({
      name: 'Lowercase Project',
      description: 'Lowercase repository',
      githubOwner: `testowner-${id}`,
      githubRepo: `testrepo-${id}`,
      key: uniqueKey(),
    });

    // Create project with different case (should succeed - case sensitive)
    await createTestProject({
      name: 'Uppercase Project',
      description: 'Uppercase repository',
      githubOwner: `TestOwner-${id}`, // Different case
      githubRepo: `TestRepo-${id}`, // Different case
      key: uniqueKey(),
    });

    // Verify both projects exist (case-sensitive uniqueness)
    const allProjects = await prisma.project.findMany({});
    expect(allProjects.length).toBeGreaterThanOrEqual(2);

    // Verify exact case matching for retrieval
    const lowercaseProject = await prisma.project.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: `testowner-${id}`,
          githubRepo: `testrepo-${id}`,
        },
      },
    });

    const uppercaseProject = await prisma.project.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: `TestOwner-${id}`,
          githubRepo: `TestRepo-${id}`,
        },
      },
    });

    expect(lowercaseProject).toBeDefined();
    expect(uppercaseProject).toBeDefined();
    expect(lowercaseProject?.id).not.toBe(uppercaseProject?.id);
  });

  test('should use composite unique constraint for lookups', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();
    // Create test project
    const createdProject = await createTestProject({
      name: 'Lookup Test Project',
      description: 'Testing composite unique constraint',
      githubOwner: `lookup-owner-${id}`,
      githubRepo: `lookup-repo-${id}`,
      key: uniqueKey(),
    });

    // Use composite unique constraint for lookup
    const foundProject = await prisma.project.findUnique({
      where: {
        githubOwner_githubRepo: {
          githubOwner: `lookup-owner-${id}`,
          githubRepo: `lookup-repo-${id}`,
        },
      },
    });

    // Verify project found using composite constraint
    expect(foundProject).toBeDefined();
    expect(foundProject?.id).toBe(createdProject.id);
    expect(foundProject?.name).toBe('[e2e] Lookup Test Project');
    expect(foundProject?.githubOwner).toBe(`lookup-owner-${id}`);
    expect(foundProject?.githubRepo).toBe(`lookup-repo-${id}`);
  });
});
