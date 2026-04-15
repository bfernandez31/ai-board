import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmap } from '@/components/heatmap/activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import type { HeatmapData } from '@/lib/heatmap/types';

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

async function fetchHeatmap(searchParams: { year?: string; agent?: string }): Promise<HeatmapData | null> {
  try {
    const userId = await requireAuth();
    const year = searchParams.year ?? 'rolling';
    const agent = searchParams.agent ?? 'all';
    return await getHeatmapData(userId, { year, agent });
  } catch {
    return null;
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; agent?: string }>;
}) {
  const search = await searchParams;
  const [projects, heatmapData] = await Promise.all([
    getProjects(),
    fetchHeatmap(search),
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

      {heatmapData && (
        <div className="mt-8">
          <ActivityHeatmap initialData={heatmapData} />
        </div>
      )}
    </div>
  );
}
