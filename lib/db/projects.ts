import { prisma } from './client';
import type { Project, ClarificationPolicy } from '@prisma/client';
import { requireAuth } from './users';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';

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
 * Ensures the current user has access (owner OR member)
 * @throws Error if project not found or user doesn't have access
 */
export async function getProject(projectId: number) {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },                            // Owner access
        { members: { some: { userId } } }      // Member access
      ]
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
 * Automatically adds AI-BOARD as a project member
 */
export async function createProject(data: {
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
}) {
  const userId = await requireAuth();
  const aiBoardUserId = await getAIBoardUserId();

  // Create project and AI-BOARD membership atomically
  return prisma.$transaction(async (tx) => {
    // Create project
    const newProject = await tx.project.create({
      data: {
        ...data,
        userId, // ← CRITICAL: inject userId
        updatedAt: new Date(), // Required field
      },
    });

    // Add AI-BOARD as project member
    await tx.projectMember.create({
      data: {
        projectId: newProject.id,
        userId: aiBoardUserId,
        role: 'member',
      },
    });

    console.log(
      `[projects] Added AI-BOARD as member to project ${newProject.id}`
    );

    return newProject;
  });
}

/**
 * Update a project
 * Ensures the project belongs to the current user
 */
export async function updateProject(
  projectId: number,
  data: {
    name?: string | undefined;
    description?: string | undefined;
    githubOwner?: string | undefined;
    githubRepo?: string | undefined;
    clarificationPolicy?: ClarificationPolicy | undefined;
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

  // Filter out undefined values for exactOptionalPropertyTypes
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.githubOwner !== undefined) updateData.githubOwner = data.githubOwner;
  if (data.githubRepo !== undefined) updateData.githubRepo = data.githubRepo;
  if (data.clarificationPolicy !== undefined) updateData.clarificationPolicy = data.clarificationPolicy;

  return prisma.project.update({
    where: { id: projectId },
    data: updateData,
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
