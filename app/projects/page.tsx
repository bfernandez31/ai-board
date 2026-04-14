import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectsActivityHeatmap } from '@/components/projects/projects-activity-heatmap';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import {
  ACTIVITY_HEATMAP_AGENT_VALUES,
  DEFAULT_ACTIVITY_HEATMAP_AGENT,
  DEFAULT_ACTIVITY_HEATMAP_VIEW,
  type ActivityHeatmapAgentScopeValue,
  type ActivityHeatmapYearViewValue,
  type ProjectsActivityHeatmapResponse,
} from '@/lib/projects/activity-heatmap-types';
import {
  getProjectsActivityHeatmap,
  isValidActivityHeatmapYearView,
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

function normalizeView(value: string | string[] | undefined): ActivityHeatmapYearViewValue {
  if (typeof value === 'string' && isValidActivityHeatmapYearView(value)) {
    return value;
  }

  return DEFAULT_ACTIVITY_HEATMAP_VIEW;
}

function normalizeAgent(value: string | string[] | undefined): ActivityHeatmapAgentScopeValue {
  if (
    typeof value === 'string' &&
    ACTIVITY_HEATMAP_AGENT_VALUES.includes(value as ActivityHeatmapAgentScopeValue)
  ) {
    return value as ActivityHeatmapAgentScopeValue;
  }

  return DEFAULT_ACTIVITY_HEATMAP_AGENT;
}

async function getInitialActivityHeatmap(
  searchParams?: Promise<Record<string, string | string[] | undefined>>
): Promise<ProjectsActivityHeatmapResponse | null> {
  try {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;

    return await getProjectsActivityHeatmap({
      view: normalizeView(resolvedSearchParams?.view),
      agent: normalizeAgent(resolvedSearchParams?.agent),
    });
  } catch (error) {
    console.error('Failed to fetch projects activity heatmap:', error);
    return null;
  }
}

interface ProjectsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const projects = await getProjects();
  const initialActivityHeatmap = await getInitialActivityHeatmap(searchParams);

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

      {initialActivityHeatmap && (
        <div className="mt-8">
          <ProjectsActivityHeatmap initialData={initialActivityHeatmap} />
        </div>
      )}
    </div>
  );
}
