import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { toJobExecutionLogDetail } from '@/lib/job-logs/storage';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; jobId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdRaw, jobId: jobIdRaw } = await context.params;
    const projectId = Number.parseInt(projectIdRaw, 10);
    const jobId = Number.parseInt(jobIdRaw, 10);

    if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project or job ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    await verifyProjectAccess(projectId);

    const log = await prisma.jobExecutionLog.findFirst({
      where: {
        jobId,
        projectId,
      },
      select: {
        jobId: true,
        projectId: true,
        ticketId: true,
        agent: true,
        availability: true,
        capturedAt: true,
        retainedUntil: true,
        prunedAt: true,
        partialReason: true,
        unavailableReason: true,
        summaryJson: true,
        artifactBytes: true,
      },
    });

    if (!log) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, projectId: true },
      });

      if (!job || job.projectId !== projectId) {
        return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
      }

      return NextResponse.json({ error: 'Log not found', code: 'LOG_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(toJobExecutionLogDetail(log));
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
          { error: 'Forbidden', code: 'ACCESS_DENIED' },
          { status: 403 }
        );
      }
    }

    console.error('[Job Log Detail] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
