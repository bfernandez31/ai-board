/**
 * GET /api/projects/[projectId]
 *
 * Retrieves a single project by ID (with authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getProject, updateProject } from '@/lib/db/projects';
import { projectUpdateSchema } from '@/app/lib/schemas/clarification-policy';
import { buildProjectApiKeysState } from '@/lib/project-api-keys';

type SerializableProject = Awaited<ReturnType<typeof getProject>> | Awaited<ReturnType<typeof updateProject>>;

function serializeProject(project: SerializableProject) {
  const tickets =
    'tickets' in project
      ? project.tickets.map((ticket) => ({
          ...ticket,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          closedAt: ticket.closedAt?.toISOString() ?? null,
        }))
      : undefined;

  const {
    anthropicApiKeyEncrypted,
    openaiApiKeyEncrypted,
    anthropicApiKeyPreview,
    openaiApiKeyPreview,
    createdAt,
    updatedAt,
    ...rest
  } = project;

  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    ...(tickets ? { tickets } : {}),
    apiKeys: buildProjectApiKeysState({
      anthropicApiKeyPreview,
      openaiApiKeyPreview,
    }),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // getProject now verifies userId ownership
    // Pass request for PAT authentication support
    const project = await getProject(projectId, request);

    return NextResponse.json(serializeProject(project));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    }

    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]
 *
 * Updates a project (with authentication)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = projectUpdateSchema.parse(body);

    const updatedProject = await updateProject(projectId, validated);

    return NextResponse.json(serializeProject(updatedProject));
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
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    }

    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
