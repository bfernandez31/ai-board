import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ProjectsActivityHeatmap } from '@/components/heatmap/projects-activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getCurrentUserOrNull } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import {
  DEFAULT_HEATMAP_FILTERS,
  isValidHeatmapAgent,
  isValidHeatmapPeriod,
} from '@/lib/heatmap/aggregations';
import { prisma } from '@/lib/db/client';
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

async function getInitialHeatmap(
  searchParams: { heatmapPeriod?: string; heatmapAgent?: string }
): Promise<HeatmapData | null> {
  const user = await getCurrentUserOrNull();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { createdAt: true },
  });
  if (!dbUser) return null;

  const filters: HeatmapFilters = {
    period:
      searchParams.heatmapPeriod && isValidHeatmapPeriod(searchParams.heatmapPeriod)
        ? searchParams.heatmapPeriod
        : DEFAULT_HEATMAP_FILTERS.period,
    agent:
      searchParams.heatmapAgent && isValidHeatmapAgent(searchParams.heatmapAgent)
        ? searchParams.heatmapAgent
        : DEFAULT_HEATMAP_FILTERS.agent,
  };

  try {
    return await getHeatmapData(user.id, dbUser.createdAt, filters);
  } catch (error) {
    console.error('Failed to fetch heatmap data:', error);
    return null;
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ heatmapPeriod?: string; heatmapAgent?: string }>;
}) {
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

      {heatmap && <ProjectsActivityHeatmap initialData={heatmap} />}
    </div>
  );
}
