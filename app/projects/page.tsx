import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getActivityHeatmapData } from '@/lib/activity-heatmap/queries';
import { normalizePeriodValue } from '@/lib/activity-heatmap/period';
import {
  isHeatmapAgentFilter,
  type ActivityHeatmapData,
  type HeatmapFilters,
} from '@/lib/activity-heatmap/types';
import { getCurrentUserOrNull } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';

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

async function getInitialHeatmap(filters: HeatmapFilters): Promise<ActivityHeatmapData | null> {
  try {
    const user = await getCurrentUserOrNull();
    if (!user) return null;
    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });
    if (!userRow) return null;
    return await getActivityHeatmapData({
      userId: user.id,
      userCreatedAt: userRow.createdAt,
      filters,
    });
  } catch (error) {
    console.error('Failed to fetch activity heatmap:', error);
    return null;
  }
}

function parseHeatmapFilters(
  searchParams: Record<string, string | string[] | undefined>
): HeatmapFilters {
  const rawPeriod = searchParams['period'];
  const period = normalizePeriodValue(
    Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod
  );
  const rawAgent = searchParams['agent'];
  const agentValue = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent;
  const agent =
    agentValue && isHeatmapAgentFilter(agentValue) ? agentValue : 'all';
  return { period, agent };
}

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const resolvedSearchParams = await searchParams;
  const heatmapFilters = parseHeatmapFilters(resolvedSearchParams);
  const [projects, heatmapData] = await Promise.all([
    getProjects(),
    getInitialHeatmap(heatmapFilters),
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
        <div className="mt-8">
          <ActivityHeatmap initialData={heatmapData} />
        </div>
      )}
    </div>
  );
}
