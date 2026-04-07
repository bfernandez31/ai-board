import { prisma } from './client';
import type { Project, ClarificationPolicy, Agent } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { requireAuth } from './users';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import type {
  ProjectHealthLabel,
  ProjectHealthSummary,
  ProjectWithCount,
} from '@/app/lib/types/project';
import {
  calculateGlobalScore,
  getScoreColorConfig,
  getScoreLabel,
} from '@/lib/health/score-calculator';

interface ProjectListHealthScore {
  securityScore: number | null;
  complianceScore: number | null;
  testsScore: number | null;
  specSyncScore: number | null;
  reviewQualityScore: number | null;
}

interface ProjectListRecord {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  updatedAt: Date;
  _count: {
    tickets: number;
  };
  tickets: Array<{
    id: number;
    ticketKey: string;
    title: string;
    updatedAt: Date;
  }>;
  healthScore: ProjectListHealthScore | null;
}

export function buildProjectHealthSummary(
  healthScore: ProjectListHealthScore | null,
  qualityGateScore: number | null,
): ProjectHealthSummary {
  const subScores = {
    security: healthScore?.securityScore ?? null,
    compliance: healthScore?.complianceScore ?? null,
    tests: healthScore?.testsScore ?? null,
    specSync: healthScore?.specSyncScore ?? null,
    qualityGate: qualityGateScore,
    reviewQuality: healthScore?.reviewQualityScore ?? null,
  };

  const globalScore = calculateGlobalScore({
    securityScore: subScores.security,
    complianceScore: subScores.compliance,
    testsScore: subScores.tests,
    specSyncScore: subScores.specSync,
    qualityGate: subScores.qualityGate,
    reviewQualityScore: subScores.reviewQuality,
  });

  return {
    globalScore,
    label: getScoreLabel(globalScore) as ProjectHealthLabel,
    color: getScoreColorConfig(globalScore),
    subScores,
  };
}

export function mapProjectToProjectWithCount(
  project: ProjectListRecord,
  qualityGateScore: number | null,
): ProjectWithCount {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    deploymentUrl: project.deploymentUrl,
    updatedAt: project.updatedAt.toISOString(),
    ticketCount: project._count.tickets,
    lastShippedTicket: project.tickets[0]
      ? {
          id: project.tickets[0].id,
          ticketKey: project.tickets[0].ticketKey,
          title: project.tickets[0].title,
          updatedAt: project.tickets[0].updatedAt.toISOString(),
        }
      : null,
    healthSummary: buildProjectHealthSummary(project.healthScore, qualityGateScore),
  };
}

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
 * Returns projects where user is owner OR member
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param request - Optional NextRequest for Bearer token extraction
 */
export async function getUserProjects(request?: NextRequest) {
  const userId = await requireAuth(request);

  return prisma.project.findMany({
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
          securityScore: true,
          complianceScore: true,
          testsScore: true,
          specSyncScore: true,
          reviewQualityScore: true,
        },
      }
    },
    orderBy: { updatedAt: 'desc' },
  });
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
    deploymentUrl?: string | null | undefined;
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
  if (data.defaultAgent !== undefined) updateData.defaultAgent = data.defaultAgent;
  if (data.deploymentUrl !== undefined) updateData.deploymentUrl = data.deploymentUrl;

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
