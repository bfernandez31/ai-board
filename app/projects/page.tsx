import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getCurrentUserOrNull } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/analytics/heatmap-queries';
import { isSupportedAgent } from '@/app/lib/utils/agent-resolution';
import type {
  AgentFilter,
  HeatmapData,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/analytics/heatmap-types';

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

function resolveInitialFilters(search: {
  heatmapPeriod?: string;
  heatmapAgent?: string;
}): HeatmapFilters {
  let period: HeatmapPeriod = { kind: 'rolling12m', endDate: '' };
  if (search.heatmapPeriod && /^\d{4}$/.test(search.heatmapPeriod)) {
    period = { kind: 'year', year: Number.parseInt(search.heatmapPeriod, 10) };
  }
  let agent: AgentFilter = 'all';
  if (search.heatmapAgent && isSupportedAgent(search.heatmapAgent)) {
    agent = search.heatmapAgent;
  }
  return { period, agent };
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ heatmapPeriod?: string; heatmapAgent?: string }>;
}) {
  const search = await searchParams;
  const [projects, user] = await Promise.all([
    getProjects(),
    getCurrentUserOrNull(),
  ]);

  let initialHeatmap: HeatmapData | null = null;
  let initialHeatmapError: { message: string } | undefined;

  if (user) {
    try {
      initialHeatmap = await getHeatmapData(user.id, resolveInitialFilters(search));
    } catch (error) {
      console.error('Failed to load activity heatmap:', error);
      initialHeatmapError = { message: "Couldn't load activity — please refresh" };
    }
  }

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

      {user && (
        <ActivityHeatmap
          userId={user.id}
          initialData={initialHeatmap}
          {...(initialHeatmapError ? { initialError: initialHeatmapError } : {})}
        />
      )}
    </div>
  );
}
