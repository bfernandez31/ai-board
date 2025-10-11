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
 */
export async function createTestProject(
  data?: Partial<Pick<TestProject, 'name' | 'description' | 'githubOwner' | 'githubRepo'>>
): Promise<TestProject> {
  const prisma = getPrismaClient();

  const project = await prisma.project.create({
    data: {
      name: data?.name ?? 'Test Project',
      description: data?.description ?? 'Test project description',
      githubOwner: data?.githubOwner ?? 'test-owner',
      githubRepo: data?.githubRepo ?? `test-repo-${Date.now()}`,
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

  // Ensure test project 1 exists (follows db-cleanup.ts pattern)
  const project = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: '[e2e] Test Project',
      description: 'Project for automated tests',
      githubOwner: 'test',
      githubRepo: 'test',
    },
  });

  // Create a fresh ticket in INBOX stage
  const ticket = await prisma.ticket.create({
    data: {
      title: '[e2e] Test Ticket for Transition',
      description: 'Test ticket for transition API E2E tests',
      stage: 'INBOX',
      projectId: project.id,
    },
  });

  return { project, ticket };
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
