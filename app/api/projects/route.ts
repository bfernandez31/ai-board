import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getUserProjects, createProject } from '@/lib/db/projects';
import type { ProjectsListResponse } from '@/app/lib/types/project';
import { generateProjectKey, isValidProjectKey, isProjectKeyAvailable } from '@/app/lib/utils/generate-project-key';
import { z } from 'zod';

// Validation schema for project creation
const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string(),
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
  key: z.string().optional(),
});

export async function GET() {
  try {
    // Fetch user's projects with ticket counts (userId filtering applied)
    const projects = await getUserProjects();

    // Transform to API response shape
    const response: ProjectsListResponse = projects.map((project) => ({
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
        title: project.tickets[0].title,
        updatedAt: project.tickets[0].updatedAt.toISOString(),
      } : null,
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

/**
 * POST /api/projects
 *
 * Create a new project with auto-generated or custom key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createProjectSchema.parse(body);

    // Determine project key (custom or auto-generated)
    let projectKey: string;

    if (validated.key) {
      // User provided custom key - validate format
      if (!isValidProjectKey(validated.key)) {
        return NextResponse.json(
          { error: 'Invalid project key format. Must be 3-6 uppercase alphanumeric characters.' },
          { status: 400 }
        );
      }

      // Check if key is available
      const isAvailable = await isProjectKeyAvailable(validated.key);
      if (!isAvailable) {
        return NextResponse.json(
          { error: 'Project key already exists. Please choose a different key.' },
          { status: 409 }
        );
      }

      projectKey = validated.key;
    } else {
      // Auto-generate key from project name
      projectKey = await generateProjectKey(validated.name);
    }

    // Create project with generated/validated key
    const newProject = await createProject({
      name: validated.name,
      description: validated.description,
      githubOwner: validated.githubOwner,
      githubRepo: validated.githubRepo,
      key: projectKey,
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
