import { notFound, redirect } from 'next/navigation';
import { getProject } from '@/lib/db/projects';
import { isSetupRequired } from '@/lib/project-setup/state';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectEntryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const projectId = parseInt(projectIdString, 10);

  if (Number.isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  const project = await getProject(projectId).catch((error) => {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }

    throw error;
  });

  if (isSetupRequired(project)) {
    redirect(`/projects/${projectId}/setup`);
  }

  redirect(`/projects/${projectId}/board`);
}
