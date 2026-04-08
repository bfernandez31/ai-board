import { notFound, redirect } from 'next/navigation';
import { getProjectWithSetupAccess } from '@/lib/db/projects';
import { isSetupRequired } from '@/lib/project-setup/state';
import { ProjectSetupPage } from '@/components/projects/project-setup-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectSetupRoutePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const projectId = parseInt(projectIdString, 10);

  if (Number.isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  const project = await getProjectWithSetupAccess(projectId).catch((error) => {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }

    throw error;
  });

  if (!isSetupRequired(project)) {
    redirect(`/projects/${projectId}/board`);
  }

  return (
    <ProjectSetupPage
      projectId={projectId}
      projectName={project.name}
    />
  );
}
