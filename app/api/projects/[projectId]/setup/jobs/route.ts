import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';
import { dispatchOnboardWorkflow } from '@/lib/workflows/dispatch-onboard';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';

function handleOwnershipError(error: unknown): NextResponse {
  if (error instanceof Error && error.message === 'Project not found') {
    return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
}

const createSetupJobSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    // Auth: owner-only
    let project;
    try {
      project = await verifyProjectOwnership(projectId, request);
    } catch (error) {
      return handleOwnershipError(error);
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = createSetupJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { agent } = parsed.data;

    // Pre-flight: check credential
    // Zod validates agent is 'CLAUDE' | 'CODEX', matching the Agent enum exactly
    const provider = AGENT_PROVIDER_MAP[agent];
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      return NextResponse.json(
        { error: `Missing ${provider} credential for ${agent}`, code: 'CREDENTIAL_MISSING' },
        { status: 409 }
      );
    }

    // Atomic check-and-create: verify not already configured and no active job, then create
    const job = await prisma.$transaction(async (tx) => {
      const projectConfig = await tx.project.findUnique({
        where: { id: projectId },
        select: { configSyncedAt: true },
      });

      if (projectConfig?.configSyncedAt) {
        return { error: 'ALREADY_CONFIGURED' as const };
      }

      const activeJob = await tx.projectSetupJob.findFirst({
        where: {
          projectId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      if (activeJob) {
        return { error: 'JOB_ACTIVE' as const };
      }

      return tx.projectSetupJob.create({
        data: {
          projectId,
          agent,
          status: 'PENDING',
        },
      });
    });

    if ('error' in job) {
      const message = job.error === 'ALREADY_CONFIGURED'
        ? 'Project is already configured'
        : 'A setup job is already active';
      return NextResponse.json(
        { error: message, code: job.error },
        { status: 409 }
      );
    }

    // Dispatch workflow
    try {
      await dispatchOnboardWorkflow({
        project_id: String(projectId),
        job_id: String(job.id),
        githubRepository: `${project.githubOwner}/${project.githubRepo}`,
        agent,
      });
    } catch (dispatchError) {
      // Mark job as failed on dispatch failure
      await prisma.projectSetupJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: dispatchError instanceof Error ? dispatchError.message : 'Dispatch failed',
          completedAt: new Date(),
        },
      });
      console.error('[setup-jobs] Dispatch failed:', dispatchError);
      return NextResponse.json(
        { error: 'Failed to dispatch onboard workflow', code: 'DISPATCH_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: job.id,
        projectId: job.projectId,
        agent: job.agent,
        status: job.status,
        createdAt: job.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[setup-jobs] POST error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    // Auth: owner-only
    try {
      await verifyProjectOwnership(projectId, request);
    } catch (error) {
      return handleOwnershipError(error);
    }

    // Get latest setup job and project config in parallel
    const [job, projectData] = await Promise.all([
      prisma.projectSetupJob.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { configSyncedAt: true },
      }),
    ]);

    return NextResponse.json({
      job: job
        ? {
            id: job.id,
            projectId: job.projectId,
            agent: job.agent,
            status: job.status,
            workflowRunId: job.workflowRunId ? Number(job.workflowRunId) : null,
            errorMessage: job.errorMessage,
            artifactSummary: job.artifactSummary,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
          }
        : null,
      configSyncedAt: projectData?.configSyncedAt ?? null,
    });
  } catch (error) {
    console.error('[setup-jobs] GET error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
