import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getCurrentUserOrNull } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { getHeatmapData } from '@/lib/activity-heatmap/queries';
import { isValidPeriod } from '@/lib/activity-heatmap/aggregations';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import type { HeatmapAgentFilter, HeatmapData, HeatmapPeriod } from '@/lib/activity-heatmap/types';

// Force dynamic rendering - this page uses headers() for auth
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects | AI Board',
  description: 'View and manage all projects in your AI Board workspace',
};

async function getProjects(): Promise<ProjectsListResponse> {
  try {
    // Use data access layer directly instead of fetch
    const projects = await getUserProjects();

    return projects.map(toProjectWithCount);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return []; // Return empty array on error (graceful degradation)
  }
}

async function getInitialHeatmap(
  searchParams: Record<string, string | string[] | undefined>
): Promise<HeatmapData | null> {
  try {
    const user = await getCurrentUserOrNull();
    if (!user) return null;

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });
    if (!userRecord) return null;

    const rawPeriod = searchParams.heatmapPeriod;
    const rawAgent = searchParams.heatmapAgent;
    const periodValue = typeof rawPeriod === 'string' ? rawPeriod : undefined;
    const agentValue = typeof rawAgent === 'string' ? rawAgent : undefined;

    const filters: { period?: HeatmapPeriod; agent?: HeatmapAgentFilter } = {};
    if (periodValue && isValidPeriod(periodValue)) {
      filters.period = periodValue;
    }
    if (
      agentValue === 'all' ||
      (agentValue && ALL_AGENTS.includes(agentValue as typeof ALL_AGENTS[number]))
    ) {
      filters.agent = agentValue as HeatmapAgentFilter;
    }

    return await getHeatmapData(user.id, userRecord.createdAt, filters);
  } catch (error) {
    console.error('Failed to fetch activity heatmap:', error);
    return null;
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const [projects, heatmapData] = await Promise.all([
    getProjects(),
    getInitialHeatmap(resolvedSearchParams),
  ]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground">Projects</h1>
        {projects.length > 0 && <ProjectsHeaderActions />}
      </div>

      <UsageBanner />

      <ProjectQuotaGate />

      <div className="mt-6">
        <ProjectsContainer projects={projects} />
      </div>

      {heatmapData && projects.length > 0 && (
        <ActivityHeatmap initialData={heatmapData} />
      )}
    </div>
  );
}
