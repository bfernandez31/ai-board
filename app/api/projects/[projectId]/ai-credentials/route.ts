import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/db/projects';
import { requireAuth } from '@/lib/db/users';
import { listProjectAiCredentials } from '@/lib/services/ai-credential-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const [project, currentUserId] = await Promise.all([
      getProject(projectId, request),
      requireAuth(request),
    ]);

    const providers = await listProjectAiCredentials(projectId, currentUserId === project.userId);
    return NextResponse.json({ providers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    console.error('[GET /api/projects/:projectId/ai-credentials] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
