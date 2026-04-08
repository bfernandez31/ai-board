import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import {
  projectSetupStatusSchema,
  projectSetupStatusUpdateSchema,
} from '@/app/lib/schemas/project-setup';
import {
  getLatestProjectSetupJob,
  updateProjectSetupStatus,
} from '@/lib/onboarding/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdValue } = await params;
    const projectId = Number(projectIdValue);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const job = await getLatestProjectSetupJob(projectId, userId);
    return NextResponse.json(job ? projectSetupStatusSchema.parse(job) : { job: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 403 });
    }

    console.error('Failed to fetch setup status:', error);
    return NextResponse.json({ error: 'Failed to fetch setup status' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authResult = validateWorkflowAuth(request);
  const allowTestOverride =
    process.env.TEST_MODE === 'true' &&
    request.headers.get('x-ai-board-test-auth-override') === 'true';

  if (!authResult.isValid && !allowTestOverride) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId: projectIdValue } = await params;
    const projectId = Number(projectIdValue);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const payload = projectSetupStatusUpdateSchema.parse(body);
    const updateParams: Parameters<typeof updateProjectSetupStatus>[0] = {
      projectId,
      jobId: payload.jobId,
      status: payload.status,
    };
    if (payload.workflowRunId) {
      updateParams.workflowRunId = BigInt(String(payload.workflowRunId));
    }
    if (payload.defaultBranch) updateParams.defaultBranch = payload.defaultBranch;
    if (payload.commitSha) updateParams.commitSha = payload.commitSha;
    if (payload.analysisSummary) updateParams.analysisSummary = payload.analysisSummary;
    if (payload.artifactManifest) updateParams.artifactManifest = payload.artifactManifest;
    if (payload.configPreview) updateParams.configPreview = payload.configPreview;
    if (payload.errorCode) updateParams.errorCode = payload.errorCode;
    if (payload.errorMessage) updateParams.errorMessage = payload.errorMessage;

    const updated = await updateProjectSetupStatus(updateParams);

    console.info('Project setup status updated', {
      projectId,
      jobId: payload.jobId,
      status: payload.status,
      workflowRunId: payload.workflowRunId ? String(payload.workflowRunId) : null,
    });

    return NextResponse.json(projectSetupStatusSchema.parse(updated));
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Setup job not found') {
      return NextResponse.json({ error: 'Setup job not found' }, { status: 404 });
    }
    if (error instanceof Error && error.name === 'InvalidSetupStatusTransition') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'StaleSetupJob') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Failed to update setup status:', error);
    return NextResponse.json({ error: 'Failed to update setup status' }, { status: 500 });
  }
}
