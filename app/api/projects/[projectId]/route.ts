/**
 * GET /api/projects/[projectId]
 *
 * Retrieves a single project by ID (with authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getProject, updateProject } from '@/lib/db/projects';
import { projectUpdateSchema } from '@/app/lib/schemas/clarification-policy';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  try {
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // getProject now verifies userId ownership
    const project = await getProject(projectId);

    return NextResponse.json(project);
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
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  try {
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

    return NextResponse.json(updatedProject);
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
