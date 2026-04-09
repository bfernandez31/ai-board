import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership, verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';
import { dispatchSpecGenerationWorkflow } from '@/lib/workflows/dispatch-spec-generation';
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

const createSpecGenJobSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
  depth: z.enum(['QUICK', 'STANDARD', 'COMPREHENSIVE']),
  documentationUrl: z.string().url().max(2000).optional().or(z.literal('')),
  additionalContext: z.string().max(5000).optional(),
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
    const parsed = createSpecGenJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { agent, depth, documentationUrl, additionalContext } = parsed.data;

    // Pre-flight: check credential
    const provider = AGENT_PROVIDER_MAP[agent];
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      return NextResponse.json(
        { error: `Missing ${provider} credential for ${agent}`, code: 'CREDENTIAL_MISSING' },
        { status: 422 }
      );
    }

    // Atomic check-and-create: verify configured and no active job, then create
    const job = await prisma.$transaction(async (tx) => {
      const projectConfig = await tx.project.findUnique({
        where: { id: projectId },
        select: { configSyncedAt: true },
      });

      if (!projectConfig?.configSyncedAt) {
        return { error: 'NOT_CONFIGURED' as const };
      }

      const activeJob = await tx.specGenerationJob.findFirst({
        where: {
          projectId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      if (activeJob) {
        return { error: 'JOB_ACTIVE' as const };
      }

      return tx.specGenerationJob.create({
        data: {
          projectId,
          agent,
          depth,
          status: 'PENDING',
          documentationUrl: documentationUrl || null,
          additionalContext: additionalContext || null,
        },
      });
    });

    if ('error' in job) {
      const message = job.error === 'NOT_CONFIGURED'
        ? 'Project is not configured'
        : 'A spec generation job is already active';
      return NextResponse.json(
        { error: message, code: job.error },
        { status: 409 }
      );
    }

    // Dispatch workflow
    try {
      await dispatchSpecGenerationWorkflow({
        project_id: String(projectId),
        job_id: String(job.id),
        githubRepository: `${project.githubOwner}/${project.githubRepo}`,
        agent,
        depth,
        documentation_url: documentationUrl || '',
        additional_context: additionalContext || '',
      });
    } catch (dispatchError) {
      await prisma.specGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: dispatchError instanceof Error ? dispatchError.message : 'Dispatch failed',
          completedAt: new Date(),
        },
      });
      console.error('[spec-gen-jobs] Dispatch failed:', dispatchError);
      return NextResponse.json(
        { error: 'Failed to dispatch spec generation workflow', code: 'DISPATCH_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: job.id,
        projectId: job.projectId,
        agent: job.agent,
        depth: job.depth,
        status: job.status,
        documentationUrl: job.documentationUrl,
        additionalContext: job.additionalContext,
        createdAt: job.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[spec-gen-jobs] POST error:', error);
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

    // Auth: owner or member
    try {
      await verifyProjectAccess(projectId, request);
    } catch (error) {
      return handleOwnershipError(error);
    }

    // Get latest spec generation job and project data in parallel
    const [job, projectData] = await Promise.all([
      prisma.specGenerationJob.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { specsGeneratedAt: true },
      }),
    ]);

    return NextResponse.json({
      job: job
        ? {
            id: job.id,
            projectId: job.projectId,
            agent: job.agent,
            depth: job.depth,
            status: job.status,
            workflowRunId: job.workflowRunId ? Number(job.workflowRunId) : null,
            errorMessage: job.errorMessage,
            artifactSummary: job.artifactSummary,
            documentationUrl: job.documentationUrl,
            additionalContext: job.additionalContext,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
          }
        : null,
      specsGeneratedAt: projectData?.specsGeneratedAt ?? null,
    });
  } catch (error) {
    console.error('[spec-gen-jobs] GET error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
