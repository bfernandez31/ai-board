import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';

/**
 * POST /api/jobs/[id]/cancel
 * Cancel a running or pending GitHub Actions workflow job.
 *
 * - Validates user has project access
 * - Only cancels PENDING or RUNNING jobs
 * - Cancels the GitHub Actions run if workflowRunId is available
 * - Sets job status to CANCELLED
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const jobId = parseInt(params.id, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    // Fetch job with project info
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        workflowRunId: true,
        projectId: true,
        command: true,
        ticket: {
          select: {
            project: {
              select: {
                githubOwner: true,
                githubRepo: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify user has access to the project
    await verifyProjectAccess(job.projectId, request);

    // Only cancel PENDING or RUNNING jobs
    if (job.status !== 'PENDING' && job.status !== 'RUNNING') {
      return NextResponse.json(
        { error: `Cannot cancel job in ${job.status} state` },
        { status: 400 }
      );
    }

    // Cancel GitHub Actions workflow run if we have the run ID
    if (job.workflowRunId) {
      const githubToken = process.env.GITHUB_TOKEN;
      if (githubToken) {
        try {
          const octokit = new Octokit({ auth: githubToken });
          const owner = process.env.GITHUB_OWNER;
          const repo = process.env.GITHUB_REPO;

          if (owner && repo) {
            await octokit.actions.cancelWorkflowRun({
              owner,
              repo,
              run_id: Number(job.workflowRunId),
            });
            console.log('[Job Cancel] GitHub workflow run cancelled:', {
              jobId,
              runId: Number(job.workflowRunId),
            });
          }
        } catch (ghError) {
          // Log but don't fail - the job should still be marked as cancelled
          console.error('[Job Cancel] Failed to cancel GitHub workflow run:', ghError);
        }
      }
    }

    // Update job status to CANCELLED
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        completedAt: true,
      },
    });

    console.log('[Job Cancel] Job cancelled:', {
      jobId,
      command: job.command,
      hadWorkflowRunId: !!job.workflowRunId,
    });

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      completedAt: updatedJob.completedAt?.toISOString() || null,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('[Job Cancel] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
