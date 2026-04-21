import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ActivityHeatmapSection } from '@/components/projects/activity-heatmap-section';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { getHeatmapInitialData } from '@/lib/heatmap/queries';
import { parsePeriodParam } from '@/lib/heatmap/period';
import { AGENT_FILTER_VALUES, type AgentFilter } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';

// Force dynamic rendering - this page uses headers() for auth
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects | AI Board',
  description: 'View and manage all projects in your AI Board workspace',
};

async function getProjects(): Promise<ProjectsListResponse> {
  try {
    const projects = await getUserProjects();
    return projects.map(toProjectWithCount);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
}

function resolveAgentFilter(raw: string | undefined): AgentFilter {
  if (!raw) return 'all';
  if ((AGENT_FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as AgentFilter;
  }
  return 'all';
}

async function getHeatmap(
  searchParams: { period?: string; agent?: string }
): Promise<{ data: HeatmapData; accountCreatedYear: number } | null> {
  try {
    const userId = await requireAuth();
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    const accountCreatedYear = user?.createdAt.getUTCFullYear() ?? now.getUTCFullYear();

    const filters: HeatmapFilters = {
      period: parsePeriodParam(searchParams.period, accountCreatedYear, now),
      agent: resolveAgentFilter(searchParams.agent),
    };

    const data = await getHeatmapInitialData(userId, filters, now);
    return { data, accountCreatedYear };
  } catch (error) {
    console.error('Failed to fetch heatmap initial data:', error);
    return null;
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; agent?: string }>;
}) {
  const search = (await searchParams) ?? {};
  const [projects, heatmap] = await Promise.all([getProjects(), getHeatmap(search)]);

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

      {heatmap && (
        <ActivityHeatmapSection
          initialData={heatmap.data}
          accountCreatedYear={heatmap.accountCreatedYear}
        />
      )}
    </div>
  );
}
