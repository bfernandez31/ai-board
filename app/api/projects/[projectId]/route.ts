/**
 * GET /api/projects/[projectId]
 *
 * Retrieves a single project by ID (with authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/db/projects';

export async function GET(
  _request: NextRequest,
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
