import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireAuth } from '@/lib/db/users';
import {
  createUserGitHubClient,
  getGitHubAccessToken,
  requireRepoScope,
} from '@/lib/github/user-client';
import { importProjectSchema } from '@/lib/validations/import-project';
import { getUserSubscription } from '@/lib/billing/subscription';
import { generateProjectKey } from '@/app/lib/utils/generate-project-key';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import { syncProjectConfig } from '@/lib/config-sync';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    await requireRepoScope(userId);

    const body = await request.json();
    const validated = importProjectSchema.parse(body);

    // Verify admin rights on the repo
    let repoData: { description: string | null };
    if (process.env.TEST_MODE === 'true') {
      repoData = { description: null };
    } else {
      const octokit = await createUserGitHubClient(userId);

      try {
        const { data } = await octokit.repos.get({
          owner: validated.githubOwner,
          repo: validated.githubRepo,
        });

        if (!data.permissions?.admin) {
          return NextResponse.json(
            {
              error: 'You need admin access to this repository to import it.',
              code: 'INSUFFICIENT_PERMISSIONS',
            },
            { status: 403 }
          );
        }

        repoData = { description: data.description };
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          return NextResponse.json(
            {
              error: 'Repository not found or you do not have access.',
              code: 'REPO_NOT_FOUND',
            },
            { status: 404 }
          );
        }
        throw error;
      }
    }

    // Determine project name and description
    const projectName = validated.name ?? validated.githubRepo;
    const projectDescription = validated.description ?? repoData.description ?? '';

    // Generate project key
    const projectKey = await generateProjectKey(projectName);

    // Check subscription quota and create project in serializable transaction
    const subscription = await getUserSubscription(userId);
    const maxProjects = subscription.limits.maxProjects;
    const aiBoardUserId = await getAIBoardUserId();

    let newProject: { id: number; name: string; key: string; githubOwner: string; githubRepo: string };

    const projectData = {
      name: projectName,
      description: projectDescription,
      githubOwner: validated.githubOwner,
      githubRepo: validated.githubRepo,
      key: projectKey,
      userId,
      updatedAt: new Date(),
    };
    const projectSelect = { id: true, name: true, key: true, githubOwner: true, githubRepo: true } as const;

    try {
      newProject = await prisma.$transaction(
        async (tx) => {
          if (maxProjects !== null) {
            const projectCount = await tx.project.count({ where: { userId } });
            if (projectCount >= maxProjects) {
              throw new Error('PLAN_LIMIT');
            }
          }

          const project = await tx.project.create({
            data: projectData,
            select: projectSelect,
          });

          await tx.projectMember.create({
            data: { projectId: project.id, userId: aiBoardUserId, role: 'member' },
          });

          return project;
        },
        maxProjects !== null ? { isolationLevel: 'Serializable' } : undefined
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'PLAN_LIMIT') {
        return NextResponse.json(
          {
            error: `Project limit reached. Your ${subscription.plan} plan allows ${maxProjects} project(s). Upgrade to create more.`,
            code: 'PLAN_LIMIT',
          },
          { status: 403 }
        );
      }

      // Handle unique constraint violations
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        const isRepoConflict = target.includes('githubOwner') || target.includes('githubRepo');

        if (isRepoConflict) {
          const existingProject = await prisma.project.findFirst({
            where: {
              githubOwner: validated.githubOwner,
              githubRepo: validated.githubRepo,
            },
            select: { id: true, name: true, key: true },
          });

          return NextResponse.json(
            {
              error: `This repository is already linked to project "${existingProject?.name ?? 'Unknown'}" (${existingProject?.key ?? 'N/A'}).`,
              code: 'DUPLICATE_REPO',
              existingProjectId: existingProject?.id ?? null,
            },
            { status: 409 }
          );
        }

        // Other unique constraint violation (e.g., key collision) — retry-worthy
        return NextResponse.json(
          {
            error: 'A conflict occurred while creating the project. Please try again.',
            code: 'CONFLICT',
          },
          { status: 409 }
        );
      }

      throw error;
    }

    // Sync config using user's token for private repo access
    const userToken = await getGitHubAccessToken(userId);
    const configResult = await syncProjectConfig(
      {
        id: newProject.id,
        githubOwner: newProject.githubOwner,
        githubRepo: newProject.githubRepo,
        configSyncedAt: null,
      },
      userToken ?? undefined
    );

    const hasConfig = configResult.success;
    const redirectTo = hasConfig
      ? `/projects/${newProject.id}`
      : `/projects/${newProject.id}/setup`;

    return NextResponse.json(
      {
        project: {
          id: newProject.id,
          name: newProject.name,
          key: newProject.key,
          githubOwner: newProject.githubOwner,
          githubRepo: newProject.githubRepo,
          hasConfig,
        },
        redirectTo,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    if (error instanceof Error && (error as Error & { code?: string }).code === 'MISSING_SCOPE') {
      return NextResponse.json(
        { error: 'GitHub token lacks repo scope', code: 'MISSING_SCOPE' },
        { status: 403 }
      );
    }

    console.error('Failed to import project:', error);
    return NextResponse.json(
      { error: 'GitHub API error', code: 'GITHUB_ERROR' },
      { status: 502 }
    );
  }
}
