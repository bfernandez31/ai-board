import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { syncProjectConfig } from '@/lib/config-sync';
import type { SetupJobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const artifactRecordSchema = z.object({
  path: z.string().min(1).max(500),
  kind: z.enum(['config', 'guidance', 'constitution', 'agent-entry', 'command', 'script', 'analysis']),
  reason: z.string().max(500).optional(),
});

const artifactSummarySchema = z.object({
  created: z.array(artifactRecordSchema).default([]),
  preserved: z.array(artifactRecordSchema).default([]),
  missing: z.array(artifactRecordSchema).default([]),
  analysisPath: z.string().max(500).optional(),
  partialReason: z.string().max(1000).optional(),
});

const setupJobStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  workflowRunId: z.number().int().positive().optional(),
  partial: z.boolean().optional(),
  commitSha: z.string().regex(/^[a-f0-9]{7,40}$/i, 'commitSha must be a git SHA').optional(),
  errorCode: z.enum([
    'DISPATCH_FAILED',
    'CONFIGURATION_GENERATION_FAILED',
    'GUIDANCE_GENERATION_FAILED',
    'COMMIT_FAILED',
  ]).optional(),
  errorMessage: z.string().max(2000).optional(),
  logs: z.string().max(10000).optional(),
  artifactSummary: artifactSummarySchema.optional(),
}).superRefine((data, ctx) => {
  if (data.partial && data.status !== 'COMPLETED') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['partial'],
      message: 'partial is only valid for COMPLETED status',
    });
  }

  if (data.status === 'FAILED' && !data.errorCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['errorCode'],
      message: 'errorCode is required for FAILED status',
    });
  }

  if (data.status === 'FAILED' && data.commitSha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['commitSha'],
      message: 'commitSha is not valid for FAILED status',
    });
  }

  if (data.status === 'RUNNING' && (data.partial !== undefined || data.commitSha || data.errorCode || data.logs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'RUNNING updates may only include workflowRunId, errorMessage, and artifactSummary',
    });
  }
});

const VALID_TRANSITIONS: Record<SetupJobStatus, SetupJobStatus[]> = {
  PENDING: ['RUNNING'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['COMPLETED'],
  FAILED: ['FAILED'],
};

function isTerminal(status: SetupJobStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; jobId: string }> }
) {
  try {
    // Auth: workflow token
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdStr, jobId: jobIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    const jobId = parseInt(jobIdStr, 10);

    if (isNaN(projectId) || projectId <= 0 || isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Parse body
    const body = await request.json();
    const parsed = setupJobStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const newStatus = data.status as SetupJobStatus;

    // Find the job
    const job = await prisma.projectSetupJob.findFirst({
      where: { id: jobId, projectId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Setup job not found' }, { status: 404 });
    }

    // Idempotent: same status returns current state
    if (job.status === newStatus) {
      return NextResponse.json({
        id: job.id,
        status: job.status,
        completedAt: job.completedAt,
      });
    }

    // Validate state transition
    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${job.status} to ${newStatus}` },
        { status: 400 }
      );
    }

    // Build update data
    const now = new Date();
    const updateData: Prisma.ProjectSetupJobUpdateInput = {
      status: newStatus,
    };

    if (newStatus === 'RUNNING' && !job.startedAt) {
      updateData.startedAt = now;
    }

    if (isTerminal(newStatus)) {
      updateData.completedAt = now;
    }

    if (data.errorMessage !== undefined) {
      updateData.errorMessage = data.errorMessage;
    }

    if (data.partial !== undefined) {
      updateData.partial = data.partial;
    } else if (newStatus === 'FAILED') {
      updateData.partial = false;
    }

    if (data.commitSha !== undefined) {
      updateData.commitSha = data.commitSha;
    }

    if (data.errorCode !== undefined) {
      updateData.errorCode = data.errorCode;
    }

    if (data.logs !== undefined) {
      updateData.logs = data.logs;
    }

    if (data.artifactSummary !== undefined) {
      updateData.artifactSummary = data.artifactSummary as Prisma.InputJsonValue;
    }

    if (data.workflowRunId !== undefined && !job.workflowRunId) {
      updateData.workflowRunId = BigInt(data.workflowRunId);
    }

    const updatedJob = await prisma.projectSetupJob.update({
      where: { id: jobId },
      data: updateData,
    });

    // On COMPLETED: trigger config sync (non-blocking)
    if (newStatus === 'COMPLETED') {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, githubOwner: true, githubRepo: true, configSyncedAt: true },
      });

      if (project) {
        syncProjectConfig(project).catch((syncError) => {
          console.error('[setup-job-status] Config sync failed:', syncError);
        });
      }
    }

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      completedAt: updatedJob.completedAt,
    });
  } catch (error) {
    console.error('[setup-job-status] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
