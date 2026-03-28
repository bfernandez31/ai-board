import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProject } from '@/lib/db/projects';
import { HealthDashboard } from '@/components/health/health-dashboard';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HealthPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const projectId = parseInt(projectIdString, 10);

  if (isNaN(projectId) || projectId <= 0) {
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
    <main className="container mx-auto py-10 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Health</h1>
            <p className="text-muted-foreground mt-2">
              Project health overview for {project.name}
            </p>
          </div>
          <Link href={`/projects/${projectId}/board`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Board
            </Button>
          </Link>
        </div>

        <HealthDashboard projectId={projectId} />
      </div>
    </main>
  );
}
