import { getPrismaClient } from './db-cleanup';

/**
 * Database setup utilities for testing project-ticket relationships
 */

export interface TestProject {
  id: number;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
}

export interface TestTicket {
  id: number;
  title: string;
  description: string;
  projectId: number;
  stage: string;
  version: number;
}

/**
 * Create a test project and return its data
 * Automatically prefixes project names with [e2e] for test isolation
 */
export async function createTestProject(
  data?: Partial<Pick<TestProject, 'name' | 'description' | 'githubOwner' | 'githubRepo'>>
): Promise<TestProject> {
  const prisma = getPrismaClient();

  // Ensure test user exists (matches db-cleanup.ts pattern)
  const testUser = await prisma.user.upsert({
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

  // Ensure test project names have [e2e] prefix for cleanup
  const projectName = data?.name ?? 'Test Project';
  const prefixedName = projectName.startsWith('[e2e]') ? projectName : `[e2e] ${projectName}`;

  const project = await prisma.project.create({
    data: {
      name: prefixedName,
      description: data?.description ?? 'Test project description',
      githubOwner: data?.githubOwner ?? 'test-owner',
      githubRepo: data?.githubRepo ?? `test-repo-${Date.now()}`,
      userId: testUser.id,
      updatedAt: new Date(),
    },
  });

  return project;
}

/**
 * Create a test ticket with projectId
 */
export async function createTestTicket(
  projectId: number,
  data?: Partial<Pick<TestTicket, 'title' | 'description' | 'stage'>>
): Promise<TestTicket> {
  const prisma = getPrismaClient();

  const ticket = await prisma.ticket.create({
    data: {
      title: data?.title ?? 'Test Ticket',
      description: data?.description ?? 'Test ticket description',
      projectId,
      stage: (data?.stage ?? 'INBOX') as 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP',
      updatedAt: new Date(),
    },
  });

  return ticket;
}

/**
 * Creates test project and ticket in INBOX stage (for transition API tests)
 * Uses standard test project 1 from db-cleanup pattern
 */
export async function setupTestData(): Promise<{ project: TestProject; ticket: TestTicket }> {
  const prisma = getPrismaClient();

  // Ensure test user exists (matches db-cleanup.ts pattern)
  const testUser = await prisma.user.upsert({
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

  // Ensure test project 1 exists with test user (follows db-cleanup.ts pattern)
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {
      userId: testUser.id,
    },
    create: {
      id: 1,
      name: '[e2e] Test Project',
      description: 'Project for automated tests',
      githubOwner: 'test',
      githubRepo: 'test',
      userId: testUser.id,
      updatedAt: new Date(),
    },
  });

  // Create a fresh ticket in INBOX stage
  const ticket = await prisma.ticket.create({
    data: {
      title: '[e2e] Test Ticket for Transition',
      description: 'Test ticket for transition API E2E tests',
      stage: 'INBOX',
      projectId: project.id,
      updatedAt: new Date(),
    },
  });

  return { project, ticket };
}

/**
 * Create a test ticket with a specific job status for testing job validation
 */
export async function createTicketWithJob(
  data: {
    stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
    jobStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    jobCommand: string;
    title?: string;
    description?: string;
  }
): Promise<{ ticket: TestTicket; jobId: number }> {
  const prisma = getPrismaClient();

  // Ensure test user exists
  const testUser = await prisma.user.upsert({
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

  // Ensure test project 1 exists
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {
      userId: testUser.id,
    },
    create: {
      id: 1,
      name: '[e2e] Test Project',
      description: 'Project for automated tests',
      githubOwner: 'test',
      githubRepo: 'test',
      userId: testUser.id,
      updatedAt: new Date(),
    },
  });

  // Create ticket
  const ticket = await prisma.ticket.create({
    data: {
      title: data.title ?? `[e2e] Test Ticket in ${data.stage}`,
      description: data.description ?? 'Test ticket for job validation',
      stage: data.stage,
      projectId: project.id,
      updatedAt: new Date(),
    },
  });

  // Create job with specified status
  const job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: project.id,
      command: data.jobCommand,
      status: data.jobStatus,
      startedAt: new Date(),
      completedAt: data.jobStatus === 'COMPLETED' ? new Date() : null,
      updatedAt: new Date(),
    },
  });

  return { ticket, jobId: job.id };
}

/**
 * Create a test member user for project member authorization tests
 * Creates user with email 'member@e2e.local' for member access testing
 */
export async function createTestMemberUser(): Promise<{ id: string; email: string }> {
  const prisma = getPrismaClient();

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@e2e.local' },
    update: {},
    create: {
      id: 'test-member-user-id',
      email: 'member@e2e.local',
      name: 'E2E Member User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  return memberUser;
}

/**
 * Add a user as a project member
 * Grants non-owner user access to a project
 */
export async function addProjectMember(
  projectId: number,
  userId: string,
  role: string = 'member'
): Promise<{ id: number; projectId: number; userId: string; role: string }> {
  const prisma = getPrismaClient();

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role,
    },
  });

  return member;
}

/**
 * Create a non-member user for authorization testing
 * Creates user who should NOT have access to test projects
 */
export async function createTestNonMemberUser(): Promise<{ id: string; email: string }> {
  const prisma = getPrismaClient();

  const nonMemberUser = await prisma.user.upsert({
    where: { email: 'nonmember@e2e.local' },
    update: {},
    create: {
      id: 'test-nonmember-user-id',
      email: 'nonmember@e2e.local',
      name: 'E2E Non-Member User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  return nonMemberUser;
}

/**
 * Setup complete test scenario with owner, member, and non-member users
 * Returns all user IDs for parameterized testing
 */
export async function setupMemberAuthTestData(): Promise<{
  project: TestProject;
  ownerUserId: string;
  memberUserId: string;
  nonMemberUserId: string;
}> {
  const prisma = getPrismaClient();

  // Ensure test user (owner) exists
  const testUser = await prisma.user.upsert({
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

  // Ensure test project 1 exists with test user
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {
      userId: testUser.id,
    },
    create: {
      id: 1,
      name: '[e2e] Test Project',
      description: 'Project for automated tests',
      githubOwner: 'test',
      githubRepo: 'test',
      userId: testUser.id,
      updatedAt: new Date(),
    },
  });

  // Create member user
  const memberUser = await createTestMemberUser();

  // Add member to project
  await addProjectMember(project.id, memberUser.id);

  // Create non-member user
  const nonMemberUser = await createTestNonMemberUser();

  return {
    project,
    ownerUserId: testUser.id,
    memberUserId: memberUser.id,
    nonMemberUserId: nonMemberUser.id,
  };
}

/**
 * @deprecated Use cleanupDatabase() from db-cleanup.ts instead.
 * This function deletes ALL projects and tickets without selective cleanup.
 * The cleanupDatabase() function preserves non-test data (projects 3+).
 */
export async function cleanupTestData(): Promise<void> {
  throw new Error(
    'cleanupTestData() is deprecated. Use cleanupDatabase() from db-cleanup.ts instead. ' +
    'This prevents accidental deletion of development data (e.g., Project 3).'
  );
}
