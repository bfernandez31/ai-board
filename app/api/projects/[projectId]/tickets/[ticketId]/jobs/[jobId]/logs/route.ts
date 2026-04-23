/**
 * GET /api/projects/[projectId]/tickets/[ticketId]/jobs/[jobId]/logs
 *
 * Retrieves the captured agent execution log for a job. Project members
 * and owners can read logs; outsiders cannot. Returns 404 when no log has
 * been captured yet (job still RUNNING or workflow pre-dates the feature).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ projectId: string; ticketId: string; jobId: string }>;
  }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    const ticketId = parseInt(params.ticketId, 10);
    const jobId = parseInt(params.jobId, 10);

    if (isNaN(projectId) || isNaN(ticketId) || isNaN(jobId)) {
      return NextResponse.json(
        { error: 'Invalid id', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    await verifyProjectAccess(projectId);

    const job = await prisma.job.findFirst({
      where: { id: jobId, ticketId, projectId },
      select: {
        id: true,
        ticketId: true,
        projectId: true,
        command: true,
        status: true,
        jobLog: {
          select: {
            id: true,
            content: true,
            summary: true,
            truncated: true,
            byteSize: true,
            eventCount: true,
            agent: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', code: 'JOB_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!job.jobLog) {
      return NextResponse.json(
        { error: 'No log captured for this job', code: 'LOG_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      command: job.command,
      status: job.status,
      log: {
        id: job.jobLog.id,
        content: job.jobLog.content,
        summary: job.jobLog.summary,
        truncated: job.jobLog.truncated,
        byteSize: job.jobLog.byteSize,
        eventCount: job.jobLog.eventCount,
        agent: job.jobLog.agent,
        createdAt: job.jobLog.createdAt,
        updatedAt: job.jobLog.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Access denied', code: 'ACCESS_DENIED' },
          { status: 403 }
        );
      }
    }

    console.error('[Job Logs Read] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
