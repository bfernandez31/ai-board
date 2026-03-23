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
