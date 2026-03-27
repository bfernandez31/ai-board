import { notFound } from 'next/navigation';
import { getProject } from '@/lib/db/projects';
import { ComparisonsPage } from '@/components/comparisons/comparisons-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectComparisonsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const projectId = parseInt(projectIdString, 10);

  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  await getProject(projectId).catch((error) => {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }
    throw error;
  });

  return (
    <main className="container mx-auto py-10 max-w-7xl">
      <ComparisonsPage projectId={projectId} />
    </main>
  );
}
