import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';
import { dispatchOnboardWorkflow } from '@/lib/workflows/dispatch-onboard';
import { dispatchRetroSpecWorkflow } from '@/lib/workflows/dispatch-retro-spec';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import type { SetupJobCommand } from '@prisma/client';
import { supportsOnboardAgent } from '@/app/lib/utils/agent-resolution';

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
  agent: z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']),
  command: z.enum(['ONBOARD', 'RETRO_SPEC']).default('ONBOARD'),
  depth: z.enum(['QUICK', 'STANDARD', 'COMPREHENSIVE']).optional(),
  docUrl: z.string().url().max(2000).optional(),
  context: z.string().optional(),
}).refine(
  (data) => data.command !== 'RETRO_SPEC' || data.depth !== undefined,
  { message: 'depth is required for RETRO_SPEC command', path: ['depth'] }
);

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

    const { agent, command, depth, docUrl, context } = parsed.data;

    if (!supportsOnboardAgent(agent)) {
      return NextResponse.json(
        {
          error: `${agent} is not supported for ${command.toLowerCase().replace('_', ' ')} setup workflows yet`,
          code: 'AGENT_UNSUPPORTED',
        },
        { status: 409 }
      );
    }

    // Pre-flight: check credential
    // Zod validates agent is one of 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI'
    const provider = AGENT_PROVIDER_MAP[agent];
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      return NextResponse.json(
        { error: `Missing ${provider} credential for ${agent}`, code: 'CREDENTIAL_MISSING' },
        { status: 409 }
      );
    }

    // Atomic check-and-create: verify preconditions and no active job, then create
    const job = await prisma.$transaction(async (tx) => {
      const projectConfig = await tx.project.findUnique({
        where: { id: projectId },
        select: { configSyncedAt: true },
      });

      if (command === 'ONBOARD') {
        // ONBOARD: configSyncedAt MUST be null
        if (projectConfig?.configSyncedAt) {
          return { error: 'ALREADY_CONFIGURED' as const };
        }
      } else {
        // RETRO_SPEC: configSyncedAt MUST be set (project must be onboarded first)
        if (!projectConfig?.configSyncedAt) {
          return { error: 'NOT_CONFIGURED' as const };
        }
      }

      // Scope active-job check by command type
      const activeJob = await tx.projectSetupJob.findFirst({
        where: {
          projectId,
          command,
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
          command,
          status: 'PENDING',
          ...(command === 'RETRO_SPEC' && {
            depth: depth ?? null,
            docUrl: docUrl ?? null,
            context: context ?? null,
          }),
        },
      });
    });

    if ('error' in job) {
      const messages: Record<string, string> = {
        ALREADY_CONFIGURED: 'Project is already configured',
        NOT_CONFIGURED: 'Project is not yet configured',
        JOB_ACTIVE: 'A setup job is already active',
      };
      return NextResponse.json(
        { error: messages[job.error] ?? job.error, code: job.error },
        { status: 409 }
      );
    }

    // Dispatch workflow
    try {
      if (command === 'RETRO_SPEC') {
        await dispatchRetroSpecWorkflow({
          project_id: String(projectId),
          job_id: String(job.id),
          githubRepository: `${project.githubOwner}/${project.githubRepo}`,
          agent,
          depth: depth!,
          docUrl,
          context,
        });
      } else {
        await dispatchOnboardWorkflow({
          project_id: String(projectId),
          job_id: String(job.id),
          githubRepository: `${project.githubOwner}/${project.githubRepo}`,
          agent,
        });
      }
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
        { error: `Failed to dispatch ${command.toLowerCase()} workflow`, code: 'DISPATCH_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: job.id,
        projectId: job.projectId,
        agent: job.agent,
        command: job.command,
        status: job.status,
        ...(command === 'RETRO_SPEC' && { depth: job.depth, docUrl: job.docUrl }),
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

    // Optional command filter
    const commandParam = request.nextUrl.searchParams.get('command');
    const commandFilter: { command?: SetupJobCommand } = {};
    if (commandParam === 'ONBOARD' || commandParam === 'RETRO_SPEC') {
      commandFilter.command = commandParam;
    }

    // Get latest setup job and project config in parallel
    const [job, projectData] = await Promise.all([
      prisma.projectSetupJob.findFirst({
        where: { projectId, ...commandFilter },
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
            command: job.command,
            status: job.status,
            depth: job.depth,
            docUrl: job.docUrl,
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
