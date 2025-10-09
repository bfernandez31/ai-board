import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';

test.describe('Selective Project Cleanup Contract', () => {
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    // Clean all projects (except those needed for tests)
    await prisma.ticket.deleteMany({});
    await prisma.project.deleteMany({});
  });

  test('should delete only [e2e] prefixed projects', async () => {
    // Arrange
    await prisma.project.createMany({
      data: [
        {
          name: '[e2e] Temp Project',
          description: 'Temp',
          githubOwner: 'test',
          githubRepo: 'temp1',
        },
        {
          name: 'Production Project',
          description: 'Prod',
          githubOwner: 'prod',
          githubRepo: 'prod',
        },
      ],
    });

    // Act
    await cleanupDatabase();

    // Assert
    const e2eProject = await prisma.project.findFirst({
      where: { name: '[e2e] Temp Project' },
    });
    const prodProject = await prisma.project.findFirst({
      where: { name: 'Production Project' },
    });

    expect(e2eProject).toBeNull(); // Deleted
    expect(prodProject).not.toBeNull(); // Preserved
  });

  test('should recreate projects 1 and 2 with [e2e] prefix', async () => {
    // Arrange: Ensure projects don't exist
    await prisma.project.deleteMany({ where: { id: { in: [1, 2] } } });

    // Act
    await cleanupDatabase();

    // Assert
    const project1 = await prisma.project.findUnique({ where: { id: 1 } });
    const project2 = await prisma.project.findUnique({ where: { id: 2 } });

    expect(project1).not.toBeNull();
    expect(project1?.name).toBe('[e2e] Test Project');
    expect(project2).not.toBeNull();
    expect(project2?.name).toBe('[e2e] Test Project 2');
  });

  test('should be idempotent (safe to call multiple times)', async () => {
    // Act: Call cleanup multiple times
    await cleanupDatabase();
    await cleanupDatabase();
    await cleanupDatabase();

    // Assert: Projects still exist correctly
    const project1 = await prisma.project.findUnique({ where: { id: 1 } });
    const project2 = await prisma.project.findUnique({ where: { id: 2 } });

    expect(project1?.name).toBe('[e2e] Test Project');
    expect(project2?.name).toBe('[e2e] Test Project 2');
  });

  test('should preserve projects without [e2e] prefix', async () => {
    // Arrange
    const projects = [
      { name: 'Important Project', repo: 'important-project' },
      { name: 'e2e without brackets', repo: 'e2e-without-brackets' },
      { name: '[prod] Different prefix', repo: 'prod-different-prefix' },
      { name: 'Suffix [e2e] position', repo: 'suffix-e2e-position' },
    ];

    for (const { name, repo } of projects) {
      await prisma.project.create({
        data: {
          name,
          description: 'Test',
          githubOwner: 'test',
          githubRepo: repo,
        },
      });
    }

    // Act
    await cleanupDatabase();

    // Assert
    for (const { name } of projects) {
      const preserved = await prisma.project.findFirst({ where: { name } });
      expect(preserved).not.toBeNull();
    }
  });

  test('should complete in <100ms', async () => {
    // Arrange: Create some [e2e] projects
    await prisma.project.createMany({
      data: [
        {
          name: '[e2e] Temp 1',
          description: 'Temp',
          githubOwner: 'test',
          githubRepo: 'temp1',
        },
        {
          name: '[e2e] Temp 2',
          description: 'Temp',
          githubOwner: 'test',
          githubRepo: 'temp2',
        },
      ],
    });

    // Act
    const startTime = Date.now();
    await cleanupDatabase();
    const duration = Date.now() - startTime;

    // Assert
    expect(duration).toBeLessThan(100);
  });
});
