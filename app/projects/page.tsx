import type { Metadata } from 'next';
import { ProjectsContainer } from '@/components/projects/projects-container';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
import type { ProjectsListResponse } from '@/app/lib/types/project';

export const metadata: Metadata = {
  title: 'Projects | AI Board',
  description: 'View and manage all projects in your AI Board workspace',
};

async function getProjects(): Promise<ProjectsListResponse> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/projects`, {
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      console.error('Failed to fetch projects:', response.statusText);
      return []; // Return empty array on error (graceful degradation)
    }

    return response.json();
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return []; // Return empty array on error
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#cdd6f4]">Projects</h1>
        <div className="flex gap-4">
          <Button variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Import Project
          </Button>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>

      <ProjectsContainer projects={projects} />
    </div>
  );
}
