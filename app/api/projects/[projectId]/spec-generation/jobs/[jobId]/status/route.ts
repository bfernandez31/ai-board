import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import type { SetupJobStatus, Prisma } from '@prisma/client';

const updateStatusSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  workflowRunId: z.number().int().positive().optional(),
  errorMessage: z.string().max(2000).optional(),
  artifactSummary: z.record(z.string(), z.unknown()).optional(),
});

const VALID_TRANSITIONS: Record<SetupJobStatus, SetupJobStatus[]> = {
  PENDING: ['RUNNING', 'FAILED'],
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
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const newStatus: SetupJobStatus = data.status;

    // Find the job
    const job = await prisma.specGenerationJob.findFirst({
      where: { id: jobId, projectId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Spec generation job not found' }, { status: 404 });
    }

    // Idempotent: same status returns current state
    if (job.status === newStatus) {
      return NextResponse.json({
        id: job.id,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    }

    // Validate state transition
    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${job.status} to ${newStatus}`, code: 'INVALID_TRANSITION' },
        { status: 409 }
      );
    }

    // Build update data
    const now = new Date();
    const updateData: Prisma.SpecGenerationJobUncheckedUpdateInput = {
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

    if (data.artifactSummary !== undefined) {
      updateData.artifactSummary = data.artifactSummary as Prisma.InputJsonValue;
    }

    if (data.workflowRunId !== undefined && !job.workflowRunId) {
      updateData.workflowRunId = BigInt(data.workflowRunId);
    }

    const updatedJob = await prisma.specGenerationJob.update({
      where: { id: jobId },
      data: updateData,
    });

    // On COMPLETED: set project.specsGeneratedAt
    if (newStatus === 'COMPLETED') {
      await prisma.project.update({
        where: { id: projectId },
        data: { specsGeneratedAt: now },
      });
    }

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      startedAt: updatedJob.startedAt,
      completedAt: updatedJob.completedAt,
    });
  } catch (error) {
    console.error('[spec-gen-job-status] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
