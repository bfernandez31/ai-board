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
 * Clean up test data after each test
 */
export async function cleanupTestData(): Promise<void> {
  const prisma = getPrismaClient();

  try {
    // Delete tickets first (child records)
    await prisma.ticket.deleteMany({});

    // Then delete projects (parent records)
    await prisma.project.deleteMany({});

    console.log('✓ Test data cleaned successfully');
  } catch (error) {
    console.error('✗ Test data cleanup failed:', error);
    throw error;
  }
}
