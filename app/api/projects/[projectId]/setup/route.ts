import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getProjectWithSetupAccess } from '@/lib/db/projects';
import {
  getProjectSetupResponse,
  ProjectSetupError,
} from '@/lib/project-setup/service';

function parseProjectId(value: string): number | null {
  const projectId = parseInt(value, 10);
  return Number.isNaN(projectId) || projectId <= 0 ? null : projectId;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdString } = await context.params;
    const projectId = parseProjectId(projectIdString);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const project = await getProjectWithSetupAccess(projectId, request);
    const viewerCanManage = project.userId === userId;
    const response = await getProjectSetupResponse(projectId, viewerCanManage);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ProjectSetupError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.error('Error fetching project setup state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
