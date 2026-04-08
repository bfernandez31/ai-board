import { prisma } from '@/lib/db/client';

export interface SetupAccessResolution {
  projectId: number;
  requiresSetup: boolean;
  isOwner: boolean;
  redirectTo: string | null;
}

export async function resolveProjectSetupAccess(
  projectId: number,
  userId: string
): Promise<SetupAccessResolution | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      userId: true,
      config: true,
      configSyncedAt: true,
      setupJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          status: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const isOwner = project.userId === userId;
  const latestJob = project.setupJobs[0] ?? null;
  const requiresSetup = project.config == null || project.configSyncedAt == null;

  if (!requiresSetup) {
    return {
      projectId: project.id,
      requiresSetup: false,
      isOwner,
      redirectTo: `/projects/${project.id}/board`,
    };
  }

  if (!isOwner) {
    return {
      projectId: project.id,
      requiresSetup: true,
      isOwner,
      redirectTo: `/projects/${project.id}/setup`,
    };
  }

  if (latestJob && (latestJob.status === 'PENDING' || latestJob.status === 'RUNNING')) {
    return {
      projectId: project.id,
      requiresSetup: true,
      isOwner,
      redirectTo: `/projects/${project.id}/setup`,
    };
  }

  return {
    projectId: project.id,
    requiresSetup: true,
    isOwner,
    redirectTo: `/projects/${project.id}/setup`,
  };
}
