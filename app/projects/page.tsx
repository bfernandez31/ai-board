import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
import type { ProjectsListResponse } from '@/app/lib/types/project';
import { getUserProjects } from '@/lib/db/projects';

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

    // Transform to API response shape
    return projects.map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      githubOwner: project.githubOwner,
      githubRepo: project.githubRepo,
      deploymentUrl: project.deploymentUrl,
      updatedAt: project.updatedAt.toISOString(),
      ticketCount: project._count.tickets,
      lastShippedTicket: project.tickets[0] ? {
        id: project.tickets[0].id,
        ticketKey: project.tickets[0].ticketKey,
        title: project.tickets[0].title,
        updatedAt: project.tickets[0].updatedAt.toISOString(),
      } : null,
    }));
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return []; // Return empty array on error (graceful degradation)
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#cdd6f4]">Projects</h1>
        {projects.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button variant="outline" disabled>
              <Upload className="mr-2 h-4 w-4" />
              Import Project
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        )}
      </div>

      <ProjectsContainer projects={projects} />
    </div>
  );
}
