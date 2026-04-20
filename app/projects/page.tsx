import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ProjectActivityHeatmap } from '@/components/projects/project-activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import {
  getProjectsActivityHeatmap,
  type ActivityHeatmapFilters,
} from '@/lib/projects/activity-heatmap';

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

interface ProjectsPageProps {
  searchParams: Promise<{ activityPeriod?: string; activityAgent?: string }>;
}

function buildHeatmapFilters(params: {
  activityPeriod?: string;
  activityAgent?: string;
}): ActivityHeatmapFilters {
  const filters: ActivityHeatmapFilters = {};

  if (params.activityPeriod) {
    filters.selectedPeriod = params.activityPeriod;
  }

  if (params.activityAgent) {
    filters.selectedAgent = params.activityAgent;
  }

  return filters;
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps): Promise<JSX.Element> {
  const filters = await searchParams;
  const projects = await getProjects();
  const heatmap = await getProjectsActivityHeatmap(buildHeatmapFilters(filters));

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

      <section className="mt-10">
        <ProjectActivityHeatmap initialData={heatmap} />
      </section>
    </div>
  );
}
