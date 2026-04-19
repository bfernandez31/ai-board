import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getCurrentUserOrNull } from '@/lib/db/users';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { getActivityHeatmap } from '@/lib/analytics/heatmap-queries';
import {
  createEmptyHeatmapPayload,
  HEATMAP_AGENT_FILTER_VALUES,
  type HeatmapAgentFilter,
  type HeatmapFilters,
  type HeatmapPayload,
  type HeatmapPeriod,
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

function resolvePeriod(raw: string | undefined, allowedYears: number[]): HeatmapPeriod {
  if (!raw || raw === 'last-12-months') return { kind: 'last-12-months' };
  const year = Number.parseInt(raw, 10);
  if (!Number.isInteger(year) || !allowedYears.includes(year)) {
    return { kind: 'last-12-months' };
  }
  return { kind: 'calendar-year', year };
}

function resolveAgent(raw: string | undefined): HeatmapAgentFilter {
  if (raw && (HEATMAP_AGENT_FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as HeatmapAgentFilter;
  }
  return 'all';
}

function resolveTimezone(raw: string | undefined): string {
  if (!raw) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: raw });
    return raw;
  } catch {
    return 'UTC';
  }
}

async function getHeatmapPayload(searchParams: {
  period?: string;
  agent?: string;
  tz?: string;
}): Promise<HeatmapPayload> {
  const initialFilters: HeatmapFilters = {
    period: { kind: 'last-12-months' },
    agent: 'all',
    timezone: resolveTimezone(searchParams.tz),
  };

  try {
    const user = await getCurrentUserOrNull();
    if (!user) {
      return createEmptyHeatmapPayload(initialFilters);
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const allowedYears: number[] = [];
    for (let y = currentYear; y >= currentYear - 20; y -= 1) {
      allowedYears.push(y);
    }
    const filters: HeatmapFilters = {
      period: resolvePeriod(searchParams.period, allowedYears),
      agent: resolveAgent(searchParams.agent),
      timezone: resolveTimezone(searchParams.tz),
    };
    return await getActivityHeatmap({ userId: user.id, filters, now });
  } catch (error) {
    console.error('Failed to load activity heatmap:', error);
    return createEmptyHeatmapPayload(initialFilters);
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; agent?: string; tz?: string }>;
}) {
  const resolvedSearch = (await searchParams) ?? {};
  const [projects, heatmapPayload] = await Promise.all([
    getProjects(),
    getHeatmapPayload(resolvedSearch),
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

      <ActivityHeatmap initialData={heatmapPayload} />
    </div>
  );
}
