import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { getWorkflowProviderCredentials } from '@/lib/services/ai-credential-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; jobId: string }> }
): Promise<NextResponse> {
  try {
    const isAuthorized = await verifyWorkflowToken(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    const jobId = parseInt(params.jobId, 10);

    if (Number.isNaN(projectId) || projectId <= 0 || Number.isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid project or job ID' }, { status: 400 });
    }

    const credentials = await getWorkflowProviderCredentials(projectId, jobId);
    if (credentials.length === 0) {
      return NextResponse.json({ error: 'Credential snapshot not found' }, { status: 404 });
    }

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('[GET /api/projects/:projectId/jobs/:jobId/provider-credentials] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
