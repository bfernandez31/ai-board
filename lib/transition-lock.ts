import { prisma } from './db/client';

/**
 * Check if a project has an active cleanup job that locks transitions
 * @param projectId - The project ID
 * @returns true if project is locked (cleanup job is PENDING or RUNNING), false otherwise
 */
export async function isProjectLocked(projectId: number): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { activeCleanupJobId: true },
  });

  if (!project?.activeCleanupJobId) return false;

  const job = await prisma.job.findUnique({
    where: { id: project.activeCleanupJobId },
    select: { status: true },
  });

  // Lock is active if job exists and is in PENDING or RUNNING state
  return job ? ['PENDING', 'RUNNING'].includes(job.status) : false;
}

/**
 * Clear the cleanup lock for a project
 * @param projectId - The project ID
 * @returns void
 */
export async function clearCleanupLock(projectId: number): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { activeCleanupJobId: null },
  });
}

/**
 * Get detailed lock information for a project
 * @param projectId - The project ID
 * @returns Lock details or null if not locked
 */
export async function getCleanupLockDetails(
  projectId: number
): Promise<{
  jobId: number;
  jobStatus: string;
  ticketKey: string;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      activeCleanupJobId: true,
    },
  });

  if (!project?.activeCleanupJobId) return null;

  const job = await prisma.job.findUnique({
    where: { id: project.activeCleanupJobId },
    select: {
      id: true,
      status: true,
      ticket: {
        select: { ticketKey: true },
      },
    },
  });

  if (!job || !['PENDING', 'RUNNING'].includes(job.status)) return null;

  return {
    jobId: job.id,
    jobStatus: job.status,
    ticketKey: job.ticket.ticketKey,
  };
}
