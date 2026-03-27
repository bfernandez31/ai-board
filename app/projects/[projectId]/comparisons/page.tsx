import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectComparisonsPage } from '@/components/comparison/project-comparisons-page';
import { getProject } from '@/lib/db/projects';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function ComparisonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ comparisonId?: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const search = await searchParams;
  const projectId = parsePositiveInteger(projectIdString);

  if (!projectId) {
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href={`/projects/${projectId}/board`}>
          <Button type="button" variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Board
          </Button>
        </Link>
      </div>

      <ProjectComparisonsPage
        projectId={projectId}
        projectName={project.name}
        initialComparisonId={parsePositiveInteger(search.comparisonId)}
      />
    </main>
  );
}
