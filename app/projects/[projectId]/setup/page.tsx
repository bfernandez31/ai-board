import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { SetupPageClient } from '@/components/setup/setup-page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectSetupPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const projectId = parseInt(projectIdString, 10);

  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    redirect('/api/auth/signin');
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      userId: true,
      configSyncedAt: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Already configured — redirect to board
  if (project.configSyncedAt) {
    redirect(`/projects/${projectId}/board`);
  }

  const isOwner = project.userId === userId;

  return (
    <SetupPageClient
      projectId={project.id}
      projectName={project.name}
      isOwner={isOwner}
    />
  );
}
