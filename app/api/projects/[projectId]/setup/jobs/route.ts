import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';
import { dispatchOnboardWorkflow } from '@/lib/workflows/dispatch-onboard';
import type { CredentialProvider } from '@prisma/client';

const createSetupJobSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});

const AGENT_TO_PROVIDER: Record<string, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Auth: owner-only
    let project;
    try {
      project = await verifyProjectOwnership(projectId, request);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (error instanceof Error && error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = createSetupJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { agent } = parsed.data;

    // Pre-flight: check if already configured
    const fullProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { configSyncedAt: true, githubOwner: true, githubRepo: true },
    });

    if (fullProject?.configSyncedAt) {
      return NextResponse.json(
        { error: 'Project is already configured' },
        { status: 409 }
      );
    }

    // Pre-flight: check for active job
    const activeJob = await prisma.projectSetupJob.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (activeJob) {
      return NextResponse.json(
        { error: 'A setup job is already active' },
        { status: 409 }
      );
    }

    // Pre-flight: check credential
    const provider = AGENT_TO_PROVIDER[agent];
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      return NextResponse.json(
        { error: `Missing ${provider} credential for ${agent}` },
        { status: 409 }
      );
    }

    // Create job
    const job = await prisma.projectSetupJob.create({
      data: {
        projectId,
        agent,
        status: 'PENDING',
      },
    });

    // Dispatch workflow
    try {
      await dispatchOnboardWorkflow({
        project_id: String(projectId),
        job_id: String(job.id),
        githubRepository: `${fullProject?.githubOwner ?? project.githubOwner}/${fullProject?.githubRepo ?? project.githubRepo}`,
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
        { error: 'Failed to dispatch onboard workflow' },
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Auth: owner-only
    try {
      await verifyProjectOwnership(projectId, request);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (error instanceof Error && error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get latest setup job
    const job = await prisma.projectSetupJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Get configSyncedAt
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { configSyncedAt: true },
    });

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
      configSyncedAt: project?.configSyncedAt ?? null,
    });
  } catch (error) {
    console.error('[setup-jobs] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
