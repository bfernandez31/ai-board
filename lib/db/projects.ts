import { prisma } from './client';
import type { Project, ClarificationPolicy, Agent } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { requireAuth } from './users';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import { SMART_DEFAULTS } from '@/lib/models/claude-models';
import { CODEX_SMART_DEFAULTS } from '@/lib/models/codex-models';
import { computeLastActivityAt, sortProjectsByActivity } from './projects-activity';

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
 * Returns projects where user is owner OR member, ordered by last activity (most recent first).
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param request - Optional NextRequest for Bearer token extraction
 */
export async function getUserProjects(request?: NextRequest) {
  const userId = await requireAuth(request);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId },                            // Owner access
        { members: { some: { userId } } }      // Member access
      ]
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      githubOwner: true,
      githubRepo: true,
      deploymentUrl: true,
      updatedAt: true,
      createdAt: true,
      userId: true,
      clarificationPolicy: true,
      defaultAgent: true,
      _count: {
        select: { tickets: true },
      },
      tickets: {
        where: { stage: 'SHIP' },              // Only shipped tickets
        orderBy: { updatedAt: 'desc' },        // Most recent first
        take: 1,                               // Only last shipped ticket
        select: {
          id: true,
          ticketKey: true,
          title: true,
          updatedAt: true,
        }
      },
      healthScore: {
        select: {
          globalScore: true,
          securityScore: true,
          complianceScore: true,
          testsScore: true,
          specSyncScore: true,
          qualityGate: true,
          reviewQualityScore: true,
        }
      }
    },
  });

  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const [ticketActivity, jobActivity] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds } },
      _max: { updatedAt: true },
    }),
    prisma.job.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds } },
      _max: { startedAt: true },
    }),
  ]);

  const ticketMaxByProject = new Map<number, Date>();
  for (const row of ticketActivity) {
    if (row._max.updatedAt) ticketMaxByProject.set(row.projectId, row._max.updatedAt);
  }
  const jobMaxByProject = new Map<number, Date>();
  for (const row of jobActivity) {
    if (row._max.startedAt) jobMaxByProject.set(row.projectId, row._max.startedAt);
  }

  const enriched = projects.map((p) => {
    const lastTicketUpdatedAt = ticketMaxByProject.get(p.id) ?? null;
    const lastJobStartedAt = jobMaxByProject.get(p.id) ?? null;
    return {
      ...p,
      lastTicketUpdatedAt,
      lastJobStartedAt,
      lastActivityAt: computeLastActivityAt(p.updatedAt, lastTicketUpdatedAt, lastJobStartedAt),
    };
  });

  return sortProjectsByActivity(enriched);
}

/**
 * Get a single project by ID
 * Ensures the current user has access (owner OR member)
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param projectId - The project ID to retrieve
 * @param request - Optional NextRequest for Bearer token extraction
 * @throws Error if project not found or user doesn't have access
 */
export async function getProject(projectId: number, request?: NextRequest) {
  const userId = await requireAuth(request);

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
  key: string;
}) {
  const userId = await requireAuth();
  const aiBoardUserId = await getAIBoardUserId();

  // Create project and AI-BOARD membership atomically
  return prisma.$transaction(async (tx) => {
    // Create project
    const newProject = await tx.project.create({
      data: {
        ...data,
        ...SMART_DEFAULTS,
        ...CODEX_SMART_DEFAULTS,
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
    defaultAgent?: Agent | undefined;
    tokenSaving?: boolean | undefined;
    deploymentUrl?: string | null | undefined;
    specifyModel?: string | null | undefined;
    planModel?: string | null | undefined;
    implementModel?: string | null | undefined;
    quickImplModel?: string | null | undefined;
    verifyModel?: string | null | undefined;
    codexSpecifyModel?: string | null | undefined;
    codexPlanModel?: string | null | undefined;
    codexImplementModel?: string | null | undefined;
    codexQuickImplModel?: string | null | undefined;
    codexVerifyModel?: string | null | undefined;
  }
) {
  const userId = await requireAuth();

  // Owner OR member may update (FR-018)
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
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
  if (data.defaultAgent !== undefined) updateData.defaultAgent = data.defaultAgent;
  // Token-saving default is owner-only (FR-001); members may edit other fields (FR-018).
  if (data.tokenSaving !== undefined) {
    if (project.userId !== userId) {
      throw new Error('Forbidden');
    }
    updateData.tokenSaving = data.tokenSaving;
  }
  if (data.deploymentUrl !== undefined) updateData.deploymentUrl = data.deploymentUrl;
  if (data.specifyModel !== undefined) updateData.specifyModel = data.specifyModel;
  if (data.planModel !== undefined) updateData.planModel = data.planModel;
  if (data.implementModel !== undefined) updateData.implementModel = data.implementModel;
  if (data.quickImplModel !== undefined) updateData.quickImplModel = data.quickImplModel;
  if (data.verifyModel !== undefined) updateData.verifyModel = data.verifyModel;
  if (data.codexSpecifyModel !== undefined) updateData.codexSpecifyModel = data.codexSpecifyModel;
  if (data.codexPlanModel !== undefined) updateData.codexPlanModel = data.codexPlanModel;
  if (data.codexImplementModel !== undefined) updateData.codexImplementModel = data.codexImplementModel;
  if (data.codexQuickImplModel !== undefined) updateData.codexQuickImplModel = data.codexQuickImplModel;
  if (data.codexVerifyModel !== undefined) updateData.codexVerifyModel = data.codexVerifyModel;

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
