import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import {
  toProjectWithCount,
  type ProjectsActivityHeatmapResponse,
  type ProjectsListResponse,
} from '@/app/lib/types/project';
import { getProjectsActivityHeatmap, getUserProjects } from '@/lib/db/projects';

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

async function getInitialProjectsActivityHeatmap(searchParams: {
  period?: string;
  year?: string;
  agent?: string;
}): Promise<ProjectsActivityHeatmapResponse> {
  return getProjectsActivityHeatmap(searchParams).catch((error) => {
    console.error('Failed to fetch projects activity heatmap:', error);

    return getProjectsActivityHeatmap();
  });
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; year?: string; agent?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [projects, activityHeatmap] = await Promise.all([
    getProjects(),
    getInitialProjectsActivityHeatmap(resolvedSearchParams),
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
        <ProjectsContainer projects={projects} activityHeatmap={activityHeatmap} />
      </div>
    </div>
  );
}
