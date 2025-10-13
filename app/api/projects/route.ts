import { NextResponse } from 'next/server';
import { getUserProjects } from '@/lib/db/projects';
import type { ProjectsListResponse } from '@/app/lib/types/project';

export async function GET() {
  try {
    // Fetch user's projects with ticket counts (userId filtering applied)
    const projects = await getUserProjects();

    // Transform to API response shape
    const response: ProjectsListResponse = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt.toISOString(),
      ticketCount: project._count.tickets,
    }));

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
