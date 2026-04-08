import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import {
  createSetupJob,
  getLatestSetupJob,
  deleteSetupJob,
  SetupJobDuplicateError,
} from '@/lib/setup/service';
import { dispatchOnboardWorkflow } from '@/lib/setup/dispatch';

const DispatchSetupSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});

/**
 * POST /api/projects/[projectId]/setup
 *
 * Dispatch the onboarding workflow for a project.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const project = await verifyProjectOwnership(projectId, request);

    // Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = DispatchSetupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid agent selection', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Check if project already has config
    const projectData = await prisma.project.findUnique({
      where: { id: projectId },
      select: { configSyncedAt: true, githubOwner: true, githubRepo: true },
    });

    if (projectData?.configSyncedAt) {
      return NextResponse.json(
        { error: 'Project already has a synced configuration', code: 'ALREADY_CONFIGURED' },
        { status: 409 }
      );
    }

    // Create setup job (duplicate guard is inside the service)
    let setupJob;
    try {
      setupJob = await createSetupJob({
        projectId,
        selectedAgent: validation.data.agent,
      });
    } catch (error) {
      if (error instanceof SetupJobDuplicateError) {
        return NextResponse.json(
          { error: error.message, code: 'SETUP_IN_PROGRESS' },
          { status: 409 }
        );
      }
      throw error;
    }

    // Dispatch workflow
    const githubRepository = `${project.githubOwner}/${project.githubRepo}`;
    try {
      await dispatchOnboardWorkflow({
        setup_job_id: String(setupJob.id),
        project_id: String(projectId),
        selected_agent: validation.data.agent,
        githubRepository,
      });
    } catch (error) {
      // Rollback: delete the setup job on dispatch failure
      await deleteSetupJob(setupJob.id);
      console.error('[setup-api] Dispatch failed, rolled back SetupJob:', error);
      return NextResponse.json(
        { error: 'Failed to dispatch onboarding workflow', code: 'DISPATCH_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: setupJob.id,
        projectId: setupJob.projectId,
        selectedAgent: setupJob.selectedAgent,
        status: setupJob.status,
        createdAt: setupJob.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Only the project owner can initiate setup', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[setup-api] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/projects/[projectId]/setup
 *
 * Get the latest setup job status for a project.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const setupJob = await getLatestSetupJob(projectId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { configSyncedAt: true },
    });

    if (!setupJob) {
      return NextResponse.json({
        setupJob: null,
        hasConfig: !!project?.configSyncedAt,
      });
    }

    return NextResponse.json({
      setupJob: {
        id: setupJob.id,
        projectId: setupJob.projectId,
        selectedAgent: setupJob.selectedAgent,
        status: setupJob.status,
        isPartial: setupJob.isPartial,
        completedFiles: setupJob.completedFiles,
        errorMessage: setupJob.errorMessage,
        workflowRunId: setupJob.workflowRunId ? Number(setupJob.workflowRunId) : null,
        startedAt: setupJob.startedAt?.toISOString() ?? null,
        completedAt: setupJob.completedAt?.toISOString() ?? null,
        createdAt: setupJob.createdAt.toISOString(),
      },
      hasConfig: !!project?.configSyncedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Only the project owner can view setup status', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[setup-api] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
