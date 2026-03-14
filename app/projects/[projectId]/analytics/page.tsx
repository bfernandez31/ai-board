import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProject } from '@/lib/db/projects';
import { getAnalyticsData } from '@/lib/analytics/queries';
import { DEFAULT_ANALYTICS_FILTERS } from '@/lib/analytics/aggregations';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { Button } from '@/components/ui/button';
import type { AgentFilter, TicketOutcomeFilter, TimeRange } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_RANGES = new Set<TimeRange>(['7d', '30d', '90d', 'all']);
const VALID_OUTCOMES = new Set<TicketOutcomeFilter>(['shipped', 'closed', 'all-completed']);
const VALID_AGENTS = new Set<AgentFilter>(['all', 'CLAUDE', 'CODEX']);

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; outcome?: string; agent?: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const search = await searchParams;

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

  const filters = {
    range: VALID_RANGES.has(search.range as TimeRange)
      ? (search.range as TimeRange)
      : DEFAULT_ANALYTICS_FILTERS.range,
    outcome: VALID_OUTCOMES.has(search.outcome as TicketOutcomeFilter)
      ? (search.outcome as TicketOutcomeFilter)
      : DEFAULT_ANALYTICS_FILTERS.outcome,
    agent: VALID_AGENTS.has(search.agent as AgentFilter)
      ? (search.agent as AgentFilter)
      : DEFAULT_ANALYTICS_FILTERS.agent,
  };

  const initialData = await getAnalyticsData(projectId, filters);

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
