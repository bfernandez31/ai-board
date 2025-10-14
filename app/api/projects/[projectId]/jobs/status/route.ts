/**
 * GET /api/projects/[projectId]/jobs/status
 *
 * Polling endpoint for job status updates
 *
 * Returns all jobs for a project with their current status.
 * Used for client-side polling at 2-second intervals.
 *
 * Contract: specs/028-519-replace-sse/contracts/job-polling-api.yml
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { JobStatusResponseSchema } from '@/app/lib/schemas/job-polling';

/**
 * GET /api/projects/[projectId]/jobs/status
 *
 * @param request - Next.js request object
 * @param params - Route parameters { projectId: string }
 * @returns JSON response with job statuses or error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // 1. Validate authentication (supports test mode via x-test-user-id header)
    let userId: string;
    try {
      userId = await requireAuth();
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // 2. Parse and validate projectId parameter
    const { projectId: projectIdParam } = await params;
    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Bad Request', code: 'INVALID_PROJECT_ID' },
        { status: 400 }
      );
    }

    // 3. Verify project exists and check ownership (authorization)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Not Found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (project.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'PROJECT_NOT_OWNED' },
        { status: 403 }
      );
    }

    // 4. Query jobs for project (performance-optimized with index)
    const jobs = await prisma.job.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        ticketId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 5. Transform to response format (ISO 8601 timestamps)
    const response = {
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        ticketId: job.ticketId,
        updatedAt: job.updatedAt.toISOString(),
      })),
    };

    // 6. Validate response schema (ensure contract compliance)
    const validated = JobStatusResponseSchema.parse(response);

    return NextResponse.json(validated, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache control: no caching for real-time data
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching job statuses:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
