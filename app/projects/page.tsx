import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap/activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getCurrentUserOrNull } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import {
  isValidAgentFilter,
  parsePeriodFilter,
} from '@/lib/heatmap/aggregations';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';

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

function resolveInitialHeatmapFilters(
  searchParams: Record<string, string | string[] | undefined>
): Partial<HeatmapFilters> {
  const rawPeriod = searchParams.heatmapPeriod;
  const periodValue = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod;
  const parsedPeriod = parsePeriodFilter(periodValue ?? null);
  const period = parsedPeriod ?? 'last12';

  const rawAgent = searchParams.heatmapAgent;
  const agentValue = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent;
  const agent = agentValue && isValidAgentFilter(agentValue) ? agentValue : 'all';

  return { period, agent };
}

async function getInitialHeatmap(
  searchParams: Record<string, string | string[] | undefined>
): Promise<HeatmapData | null> {
  const user = await getCurrentUserOrNull();
  if (!user) return null;
  try {
    const filters = resolveInitialHeatmapFilters(searchParams);
    return await getHeatmapData(user.id, filters);
  } catch (error) {
    console.error('Failed to load activity heatmap:', error);
    return null;
  }
}

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const resolvedSearchParams = await searchParams;
  const [projects, heatmap] = await Promise.all([
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

      {heatmap && <ActivityHeatmap initialData={heatmap} />}
    </div>
  );
}
