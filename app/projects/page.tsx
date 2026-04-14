import type { JSX } from 'react';
import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { ProjectQuotaGate } from '@/components/projects/project-quota-gate';
import { UsageBanner } from '@/components/billing/usage-banner';
import { ProjectsHeaderActions } from '@/components/projects/projects-header-actions';
import { ProjectActivityHeatmap } from '@/components/projects/project-activity-heatmap';
import { toProjectWithCount, type ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';
import { getProjectActivityHeatmap } from '@/lib/projects/activity-heatmap';

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

async function getInitialActivityHeatmap(projectCount: number) {
  if (projectCount === 0) {
    return null;
  }

  return getProjectActivityHeatmap({ year: 'rolling', agent: 'all' });
}

export default async function ProjectsPage(): Promise<JSX.Element> {
  const projects = await getProjects();
  const activityHeatmap = await getInitialActivityHeatmap(projects.length);

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

      {activityHeatmap && (
        <div className="mt-8">
          <ProjectActivityHeatmap initialData={activityHeatmap} />
        </div>
      )}
    </div>
  );
}
