import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectShell } from '@/components/layout/project-shell';
import { getProject } from '@/lib/db/projects';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ActivityPage({
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
    <ProjectShell projectId={projectId}>
      <main className="container mx-auto max-w-4xl py-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
              <p className="mt-2 text-muted-foreground">
                Recent activity for {project.name}
              </p>
            </div>
            <Link href={`/projects/${projectId}/board`}>
              <Button variant="outline" size="sm" className="min-h-[44px]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Board
              </Button>
            </Link>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <ActivityFeed projectId={projectId} />
          </div>
        </div>
      </main>
    </ProjectShell>
  );
}
