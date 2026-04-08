import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess, verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import type { Agent } from '@prisma/client';

type SetupState = 'NEEDS_SETUP' | 'IN_PROGRESS' | 'COMPLETED' | 'SYNC_FAILED' | 'FAILED' | 'CONFIGURED';

function deriveSetupState(
  configSyncedAt: Date | null,
  latestJob: { status: string; } | null
): SetupState {
  if (configSyncedAt) return 'CONFIGURED';
  if (!latestJob) return 'NEEDS_SETUP';
  switch (latestJob.status) {
    case 'PENDING':
    case 'RUNNING':
      return 'IN_PROGRESS';
    case 'COMPLETED':
      return 'SYNC_FAILED';
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED';
    default:
      return 'NEEDS_SETUP';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { configSyncedAt: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const latestJob = await prisma.projectSetupJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        agent: true,
        status: true,
        logs: true,
        artifactSummary: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const setupState = deriveSetupState(project.configSyncedAt, latestJob);

    return NextResponse.json({
      setupState,
      latestJob: latestJob
        ? {
            id: latestJob.id,
            agent: latestJob.agent,
            status: latestJob.status,
            logs: latestJob.logs,
            artifactSummary: latestJob.artifactSummary,
            startedAt: latestJob.startedAt.toISOString(),
            completedAt: latestJob.completedAt?.toISOString() ?? null,
          }
        : null,
      configSyncedAt: project.configSyncedAt?.toISOString() ?? null,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    console.error('[Setup GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const postBodySchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { agent } = parsed.data;

    // Check if already configured
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, configSyncedAt: true, githubOwner: true, githubRepo: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.configSyncedAt) {
      return NextResponse.json(
        { error: 'Project is already configured', code: 'ALREADY_CONFIGURED' },
        { status: 409 }
      );
    }

    // Check for active job
    const activeJob = await prisma.projectSetupJob.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (activeJob) {
      return NextResponse.json(
        { error: 'A setup job is already in progress', code: 'JOB_IN_PROGRESS' },
        { status: 409 }
      );
    }

    // Verify credential
    const provider = AGENT_PROVIDER_MAP[agent as Agent];
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      return NextResponse.json(
        {
          error: getMissingCredentialError(provider),
          code: 'MISSING_CREDENTIAL',
        },
        { status: 422 }
      );
    }

    // Create setup job
    const setupJob = await prisma.projectSetupJob.create({
      data: {
        projectId,
        agent: agent as Agent,
      },
    });

    // Dispatch workflow (skip in test mode)
    const githubToken = process.env.GITHUB_TOKEN;
    if (!isWorkflowTestMode(githubToken)) {
      const octokit = new Octokit({ auth: githubToken });
      await octokit.actions.createWorkflowDispatch({
        owner: process.env.GITHUB_REPOSITORY_OWNER ?? 'ai-board-org',
        repo: process.env.GITHUB_REPOSITORY_NAME ?? 'ai-board',
        workflow_id: 'onboard.yml',
        ref: 'main',
        inputs: {
          projectId: String(projectId),
          setupJobId: String(setupJob.id),
          githubRepository: `${project.githubOwner}/${project.githubRepo}`,
          agent: agent.toLowerCase(),
          callbackUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
          workflowToken: process.env.WORKFLOW_API_TOKEN ?? '',
        },
      });
    }

    return NextResponse.json(
      {
        jobId: setupJob.id,
        status: 'PENDING',
        agent: setupJob.agent,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Only the project owner can dispatch setup' },
        { status: 403 }
      );
    }
    console.error('[Setup POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
