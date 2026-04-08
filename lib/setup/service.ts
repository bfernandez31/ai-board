import { prisma } from '@/lib/db/client';
import { syncProjectConfig } from '@/lib/config-sync';
import type { Agent, SetupJob, SetupJobStatus } from '@prisma/client';

export interface CreateSetupJobInput {
  projectId: number;
  selectedAgent: Agent;
}

export interface SetupJobStatusUpdate {
  status: SetupJobStatus;
  isPartial?: boolean;
  completedFiles?: string[];
  errorMessage?: string;
  workflowRunId?: bigint;
}

/**
 * Create a new SetupJob for a project.
 * Rejects if an active job (PENDING/RUNNING) already exists.
 */
export async function createSetupJob(input: CreateSetupJobInput): Promise<SetupJob> {
  const existing = await prisma.setupJob.findFirst({
    where: {
      projectId: input.projectId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
  });

  if (existing) {
    throw new SetupJobDuplicateError('A setup job is already pending or running');
  }

  return prisma.setupJob.create({
    data: {
      projectId: input.projectId,
      selectedAgent: input.selectedAgent,
      status: 'PENDING',
    },
  });
}

/**
 * Get the latest SetupJob for a project (most recent first).
 */
export async function getLatestSetupJob(projectId: number): Promise<SetupJob | null> {
  return prisma.setupJob.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update SetupJob status with optional metadata.
 * Triggers config sync on COMPLETED status.
 */
export async function updateSetupJobStatus(
  setupJobId: number,
  update: SetupJobStatusUpdate
): Promise<SetupJob> {
  const data: Record<string, unknown> = {
    status: update.status,
  };

  if (update.isPartial !== undefined) {
    data.isPartial = update.isPartial;
  }
  if (update.completedFiles !== undefined) {
    data.completedFiles = update.completedFiles;
  }
  if (update.errorMessage !== undefined) {
    data.errorMessage = update.errorMessage;
  }
  if (update.workflowRunId !== undefined) {
    data.workflowRunId = update.workflowRunId;
  }

  if (update.status === 'RUNNING') {
    data.startedAt = new Date();
  }

  if (update.status === 'COMPLETED' || update.status === 'FAILED') {
    data.completedAt = new Date();
  }

  const updatedJob = await prisma.setupJob.update({
    where: { id: setupJobId },
    data,
  });

  // Trigger config sync on completion
  if (update.status === 'COMPLETED') {
    await triggerConfigSync(updatedJob.projectId);
  }

  return updatedJob;
}

/**
 * Delete a SetupJob (used for rollback on dispatch failure).
 */
export async function deleteSetupJob(setupJobId: number): Promise<void> {
  await prisma.setupJob.delete({ where: { id: setupJobId } });
}

/**
 * Trigger config sync for a project after setup job completion.
 */
async function triggerConfigSync(projectId: number): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, githubOwner: true, githubRepo: true, configSyncedAt: true },
  });

  if (!project) return;

  try {
    await syncProjectConfig(project);
  } catch (error) {
    console.error('[setup-service] Config sync failed after setup completion:', error);
  }
}

export class SetupJobDuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetupJobDuplicateError';
  }
}
