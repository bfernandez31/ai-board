import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getActivityHeatmap } from '@/lib/activity-heatmap/queries';
import type { HeatmapData, HeatmapPeriod } from '@/lib/activity-heatmap/types';
import { HEATMAP_AGENT_FILTER_VALUES } from '@/lib/activity-heatmap/types';

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

function parseHeatmapPeriod(value: string | string[] | undefined): HeatmapPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'last-12-months') return 'last-12-months';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 'last-12-months' : parsed;
}

function parseHeatmapAgent(
  value: string | string[] | undefined
): (typeof HEATMAP_AGENT_FILTER_VALUES)[number] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 'all';
  return (HEATMAP_AGENT_FILTER_VALUES as readonly string[]).includes(raw)
    ? (raw as (typeof HEATMAP_AGENT_FILTER_VALUES)[number])
    : 'all';
}

async function getInitialHeatmapData(searchParams: {
  heatmapPeriod?: string | string[];
  heatmapAgent?: string | string[];
}): Promise<HeatmapData | null> {
  try {
    return await getActivityHeatmap({
      filters: {
        period: parseHeatmapPeriod(searchParams.heatmapPeriod),
        agent: parseHeatmapAgent(searchParams.heatmapAgent),
      },
    });
  } catch (error) {
    console.error('Failed to fetch initial heatmap data:', error);
    return null;
  }
}

interface ProjectsPageProps {
  searchParams: Promise<{
    heatmapPeriod?: string | string[];
    heatmapAgent?: string | string[];
  }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const resolvedSearchParams = await searchParams;
  const [projects, heatmapData] = await Promise.all([
    getProjects(),
    getInitialHeatmapData(resolvedSearchParams),
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

      {heatmapData && <ActivityHeatmap initialData={heatmapData} />}
    </div>
  );
}
