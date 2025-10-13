import { getPrismaClient } from './db-cleanup';
import crypto from 'crypto';

/**
 * Authentication helper for E2E tests
 * Creates a database session for the test user (simpler than JWT for tests)
 */

export async function createTestSession() {
  const prisma = getPrismaClient();

  // Get or create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });

  // Create a session in database
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.upsert({
    where: { sessionToken },
    update: {
      expires,
      userId: testUser.id,
    },
    create: {
      sessionToken,
      expires,
      userId: testUser.id,
    },
  });

  return {
    sessionToken,
    userId: testUser.id,
  };
}

/**
 * Get test user session cookie for Playwright
 */
export async function getTestSessionCookie() {
  const { sessionToken } = await createTestSession();

  return {
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };
}

/**
 * Get test user ID for API authentication via header
 */
export async function getTestUserId(): Promise<number> {
  const prisma = getPrismaClient();

  // Get or create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });

  return testUser.id;
}
