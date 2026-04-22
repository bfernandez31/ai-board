import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { syncProjectConfig } from '@/lib/config-sync';
import { getGitHubAccessToken } from '@/lib/github/user-client';
import type { SetupJobStatus, Prisma } from '@prisma/client';

const setupJobStatusUpdateSchema = z.object({
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
    const parsed = setupJobStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    // Zod validates status is 'RUNNING' | 'COMPLETED' | 'FAILED', a subset of SetupJobStatus
    const newStatus: SetupJobStatus = data.status;

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
    const updateData: Prisma.ProjectSetupJobUncheckedUpdateInput = {
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
      // Zod z.record(z.string(), z.unknown()) validates JSON-compatible structure; cast to Prisma's InputJsonValue
      updateData.artifactSummary = data.artifactSummary as Prisma.InputJsonValue;
    }

    if (data.workflowRunId !== undefined && !job.workflowRunId) {
      updateData.workflowRunId = BigInt(data.workflowRunId);
    }

    const updatedJob = await prisma.projectSetupJob.update({
      where: { id: jobId },
      data: updateData,
    });

    // On COMPLETED: trigger post-completion side effects
    if (newStatus === 'COMPLETED') {
      if (job.command === 'RETRO_SPEC') {
        // Mark project as having specs generated
        await prisma.project.update({
          where: { id: projectId },
          data: { hasSpecs: true },
        });
      } else {
        // ONBOARD: trigger config sync
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, userId: true, githubOwner: true, githubRepo: true, configSyncedAt: true },
        });

        if (project) {
          const persistSyncFailure = async (
            message: string,
            code?: string,
            details?: unknown,
          ): Promise<void> => {
            const existingSummary =
              (updatedJob.artifactSummary as Record<string, unknown> | null) ?? {};
            const syncFailureSummary: Record<string, unknown> = {
              ...existingSummary,
              configSyncError: message,
            };
            if (code) syncFailureSummary.configSyncErrorCode = code;
            if (details !== undefined) syncFailureSummary.configSyncDetails = details;
            if (!syncFailureSummary.errorCode) {
              syncFailureSummary.errorCode = code ?? 'CONFIG_SYNC_FAILED';
            }

            await prisma.projectSetupJob.update({
              where: { id: jobId },
              data: {
                errorMessage: `Config sync failed: ${message}`,
                artifactSummary: syncFailureSummary as Prisma.InputJsonValue,
              },
            });
          };

          try {
            const ownerToken = await getGitHubAccessToken(project.userId);
            const configSyncResult = await syncProjectConfig(project, ownerToken ?? undefined);

            if (!configSyncResult.success) {
              console.error('[setup-job-status] Config sync failed:', configSyncResult.error);
              await persistSyncFailure(
                configSyncResult.error || 'Config sync failed',
                configSyncResult.code,
                'details' in configSyncResult ? configSyncResult.details : undefined,
              );
              return NextResponse.json({
                id: updatedJob.id,
                status: updatedJob.status,
                completedAt: updatedJob.completedAt,
                configSyncError: configSyncResult.error || 'Config sync failed',
                configSyncErrorCode: configSyncResult.code,
              });
            }
          } catch (syncError) {
            console.error('[setup-job-status] Config sync failed:', syncError);
            const message =
              syncError instanceof Error ? syncError.message : 'Config sync failed';
            await persistSyncFailure(message);
            return NextResponse.json({
              id: updatedJob.id,
              status: updatedJob.status,
              completedAt: updatedJob.completedAt,
              configSyncError: message,
            });
          }
        }
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
