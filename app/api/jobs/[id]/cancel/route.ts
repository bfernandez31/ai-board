import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { cancelWorkflowRun } from '@/lib/workflows/cancel-workflow-run';

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

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

    // Fetch job with ticket and project
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        ticket: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify user has project access
    try {
      await verifyProjectAccess(job.ticket.projectId, request);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Not authorized to cancel this job' }, { status: 401 });
      }
      if (error instanceof Error && error.message === 'Project not found') {
        return NextResponse.json({ error: 'Not authorized to cancel this job' }, { status: 403 });
      }
      throw error;
    }

    // Already terminal — idempotent response
    if (TERMINAL_STATUSES.includes(job.status)) {
      return NextResponse.json({
        id: job.id,
        status: job.status,
        completedAt: job.completedAt?.toISOString() || null,
        alreadyTerminal: true,
      });
    }

    // RUNNING job with workflowRunId — cancel via GitHub API
    if (job.status === 'RUNNING' && job.workflowRunId) {
      const githubRepository = `${job.ticket.project.githubOwner}/${job.ticket.project.githubRepo}`;

      try {
        await cancelWorkflowRun(job.workflowRunId, githubRepository);
      } catch (error) {
        console.error('[Cancel Job] GitHub API error:', error);
        return NextResponse.json(
          { error: 'Failed to cancel GitHub workflow run' },
          { status: 502 }
        );
      }
    }

    // Mark as CANCELLED
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    console.log('[Cancel Job] Success:', { jobId, previousStatus: job.status });

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      completedAt: updatedJob.completedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('[Cancel Job] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
