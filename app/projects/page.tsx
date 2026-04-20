import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap/activity-heatmap';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const projects = await getProjects();
  const resolvedSearchParams = await searchParams;

  // Type cast for Heatmap props
  const heatmapParams = {
    agent: typeof resolvedSearchParams.agent === 'string' ? resolvedSearchParams.agent : undefined,
    year: typeof resolvedSearchParams.year === 'string' ? resolvedSearchParams.year : undefined,
  };

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

      <Suspense fallback={<Skeleton className="h-[200px] w-full mt-12" />}>
        <ActivityHeatmap searchParams={heatmapParams} />
      </Suspense>
    </div>
  );
}
