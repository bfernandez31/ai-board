import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { cancelWorkflowRun } from '@/app/lib/workflows/cancel-workflow';

/**
 * POST /api/jobs/[id]/cancel
 * Cancel a PENDING or RUNNING job. Session auth required.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user via session
    let userId: string;
    try {
      userId = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const jobId = parseInt(params.id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    // Fetch job with ticket and project for authorization
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        ticket: {
          include: {
            project: {
              select: {
                id: true,
                userId: true,
                githubOwner: true,
                githubRepo: true,
                members: { where: { userId }, select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify project access (owner or member)
    const project = job.ticket.project;
    const hasAccess = project.userId === userId || project.members.length > 0;
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Idempotent: re-cancelling a CANCELLED job returns success
    if (job.status === 'CANCELLED') {
      return NextResponse.json({
        id: job.id,
        status: job.status,
        completedAt: job.completedAt?.toISOString() || null,
      });
    }

    // Only PENDING or RUNNING jobs can be cancelled
    if (job.status !== 'PENDING' && job.status !== 'RUNNING') {
      return NextResponse.json(
        { error: `Job status ${job.status} does not allow cancellation` },
        { status: 400 }
      );
    }

    // If RUNNING with workflowRunId, attempt to cancel the GitHub workflow
    if (job.status === 'RUNNING' && job.workflowRunId) {
      await cancelWorkflowRun(
        job.workflowRunId,
        project.githubOwner,
        project.githubRepo
      );
    } else if (job.status === 'RUNNING' && !job.workflowRunId) {
      console.warn('[Cancel Job] RUNNING job has no workflowRunId, marking CANCELLED locally:', { jobId });
    }

    // Mark job as CANCELLED
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

    console.log('[Cancel Job] Job cancelled:', { jobId, previousStatus: job.status });

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      completedAt: updatedJob.completedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('[Cancel Job] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
