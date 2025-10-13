import { prisma } from './client';
import type { Project } from '@prisma/client';
import { requireAuth } from './users';

/**
 * Retrieve a project by its ID
 * @param projectId - The project ID to look up
 * @returns The project if found, null otherwise
 * @deprecated Use getProject instead for authentication
 */
export async function getProjectById(
  projectId: number
): Promise<Project | null> {
  return await prisma.project.findUnique({
    where: { id: projectId },
  });
}

/**
 * Get all projects for the current user
 */
export async function getUserProjects() {
  const userId = await requireAuth();

  return prisma.project.findMany({
    where: { userId },
    include: {
      _count: {
        select: { tickets: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get a single project by ID
 * Ensures the project belongs to the current user
 * @throws Error if project not found or doesn't belong to user
 */
export async function getProject(projectId: number) {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId, // ← CRITICAL: filter by userId
    },
    include: {
      tickets: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found'); // Returns 404
  }

  return project;
}

/**
 * Create a new project for the current user
 */
export async function createProject(data: {
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
}) {
  const userId = await requireAuth();

  return prisma.project.create({
    data: {
      ...data,
      userId, // ← CRITICAL: inject userId
    },
  });
}

/**
 * Update a project
 * Ensures the project belongs to the current user
 */
export async function updateProject(
  projectId: number,
  data: {
    name?: string;
    description?: string;
    githubOwner?: string;
    githubRepo?: string;
  }
) {
  const userId = await requireAuth();

  // Verify ownership first
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return prisma.project.update({
    where: { id: projectId },
    data,
  });
}

/**
 * Delete a project
 * Ensures the project belongs to the current user
 */
export async function deleteProject(projectId: number) {
  const userId = await requireAuth();

  // Verify ownership first
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return prisma.project.delete({
    where: { id: projectId },
  });
}
