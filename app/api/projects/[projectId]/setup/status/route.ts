import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { canTransition, isTerminalStatus } from '@/app/lib/job-state-machine';
import { syncProjectConfig } from '@/lib/config-sync';
import type { JobStatus } from '@/app/lib/job-state-machine';

const patchBodySchema = z.object({
  jobId: z.number(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  logs: z.string().optional(),
  artifactSummary: z.unknown().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Authenticate via workflow token
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { jobId, status, logs, artifactSummary } = parsed.data;

    // Find the job
    const job = await prisma.projectSetupJob.findFirst({
      where: { id: jobId, projectId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Setup job not found' }, { status: 404 });
    }

    // Validate state transition
    if (!canTransition(job.status as JobStatus, status as JobStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${job.status} to ${status}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status };

    if (isTerminalStatus(status as JobStatus)) {
      updateData.completedAt = new Date();
    }

    if (logs !== undefined) {
      updateData.logs = logs;
    }

    if (artifactSummary !== undefined) {
      updateData.artifactSummary = artifactSummary;
    }

    // Update the job
    const updatedJob = await prisma.projectSetupJob.update({
      where: { id: jobId },
      data: updateData,
    });

    // On COMPLETED, trigger config sync
    let configSynced = false;
    if (status === 'COMPLETED') {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, githubOwner: true, githubRepo: true, configSyncedAt: true },
        });

        if (project) {
          const syncResult = await syncProjectConfig(project);
          configSynced = syncResult.success;
        }
      } catch (syncError) {
        console.error('[Setup Status PATCH] Config sync failed:', syncError);
      }
    }

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      completedAt: updatedJob.completedAt?.toISOString() ?? null,
      configSynced,
    });
  } catch (error) {
    console.error('[Setup Status PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
