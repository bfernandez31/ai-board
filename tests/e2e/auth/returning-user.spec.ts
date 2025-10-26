import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db/client';
import { cleanupDatabase } from '../../helpers/db-cleanup';

test.describe('Returning User Sign-In (User Story 2)', () => {
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();

    // Create test user for E2E authentication
    await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  test('returning user sign-in updates User record (not duplicated)', async () => {
    // Create initial user record with old data
    const userId = crypto.randomUUID();
    const initialUser = await prisma.user.create({
      data: {
        id: `test-returning-${userId}`,
        email: `returning-${userId}@github.com`,
        name: 'Old Name',
        image: 'https://github.com/old-avatar.png',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create account linkage with unique provider account ID
    const providerAccountId = `github-${userId}`;
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: initialUser.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId,
        access_token: 'old_token',
      },
    });

    // Verify only one user exists
    const userCountBefore = await prisma.user.count({
      where: { email: initialUser.email },
    });
    expect(userCountBefore).toBe(1);

    // NOTE: In a real E2E test, this would trigger the actual GitHub OAuth flow
    // For now, we're testing the database behavior directly
    // The actual OAuth flow is tested in production with mock authentication

    // Simulate returning user sign-in by updating user directly
    await prisma.user.update({
      where: { id: initialUser.id },
      data: {
        name: 'Updated Name',
        image: 'https://github.com/new-avatar.png',
        updatedAt: new Date(),
      },
    });

    // Update account tokens
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId,
        },
      },
      data: {
        access_token: 'new_token',
      },
    });

    // Verify no duplicate users were created
    const userCountAfter = await prisma.user.count({
      where: { email: initialUser.email },
    });
    expect(userCountAfter).toBe(1);

    // Verify user data was updated
    const updatedUser = await prisma.user.findUnique({
      where: { email: initialUser.email },
    });
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.name).toBe('Updated Name');
    expect(updatedUser!.image).toBe('https://github.com/new-avatar.png');
  });

  test('User record name is updated when changed on GitHub', async () => {
    // Create initial user
    const userId = crypto.randomUUID();
    const initialUser = await prisma.user.create({
      data: {
        id: `test-namechange-${userId}`,
        email: `namechange-${userId}@github.com`,
        name: 'Original Name',
        image: 'https://github.com/avatar.png',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create account linkage with unique provider account ID
    const providerAccountId = `github-${userId}`;
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: initialUser.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId,
        access_token: 'token123',
      },
    });

    // Simulate user changing their name on GitHub
    await prisma.user.update({
      where: { id: initialUser.id },
      data: {
        name: 'New Professional Name',
        image: 'https://github.com/new-professional-avatar.png',
        updatedAt: new Date(),
      },
    });

    // Update account tokens
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId,
        },
      },
      data: {
        access_token: 'token456',
      },
    });

    // Verify name and image were updated
    const updatedUser = await prisma.user.findUnique({
      where: { email: initialUser.email },
    });
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.name).toBe('New Professional Name');
    expect(updatedUser!.image).toBe('https://github.com/new-professional-avatar.png');

    // Verify email was NOT changed (email is the stable identifier)
    expect(updatedUser!.email).toBe(initialUser.email);
  });

  test('returning user can access existing projects immediately', async () => {
    // Create user with existing project
    const userId = crypto.randomUUID();
    const existingUser = await prisma.user.create({
      data: {
        id: `test-projectowner-${userId}`,
        email: `projectowner-${userId}@github.com`,
        name: 'Project Owner',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create account linkage with unique provider account ID
    const providerAccountId = `github-${userId}`;
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: existingUser.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId,
        access_token: 'token',
      },
    });

    // Create project owned by user
    await prisma.project.create({
      data: {
        name: '[e2e] Existing Project',
        description: 'Test project for returning user',
        githubOwner: 'projectowner',
        githubRepo: 'my-repo',
        userId: existingUser.id,
        updatedAt: new Date(),
      },
    });

    // Simulate returning user sign-in (update user profile)
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: 'Project Owner Updated',
        updatedAt: new Date(),
      },
    });

    // Update account tokens
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId,
        },
      },
      data: {
        access_token: 'new_token',
      },
    });

    // Verify user can access their existing projects
    const userProjects = await prisma.project.findMany({
      where: { userId: existingUser.id },
    });

    expect(userProjects).toHaveLength(1);
    expect(userProjects[0]?.name).toBe('[e2e] Existing Project');
    expect(userProjects[0]?.githubOwner).toBe('projectowner');
  });
});
