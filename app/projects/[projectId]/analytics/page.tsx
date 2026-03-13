import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProject } from '@/lib/db/projects';
import { getAnalyticsData } from '@/lib/analytics/queries';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { Button } from '@/components/ui/button';
import type { StatusFilter, TimeRange } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; status?: string; agent?: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const { range = '30d', status = 'shipped', agent } = await searchParams;

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

  const validRange = ['7d', '30d', '90d', 'all'].includes(range) ? (range as TimeRange) : '30d';
  const validStatus = ['shipped', 'closed', 'all'].includes(status) ? (status as StatusFilter) : 'shipped';
  const validAgent = agent && agent.length > 0 ? agent : null;
  const initialData = await getAnalyticsData(projectId, validRange, validStatus, validAgent);

  return (
    <main className="container mx-auto py-10 max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-2">AI workflow metrics for {project.name}</p>
          </div>
          <Link href={`/projects/${projectId}/board`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Board
            </Button>
          </Link>
        </div>

        <AnalyticsDashboard projectId={projectId} initialData={initialData} />
      </div>
    </main>
  );
}
