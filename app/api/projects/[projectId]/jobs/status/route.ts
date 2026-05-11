/**
 * GET /api/projects/[projectId]/jobs/status
 *
 * Polling endpoint for job status updates
 *
 * Returns active jobs for a project with their current status.
 * Clients can optionally keep specific jobs tracked via `jobIds`.
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
      userId = await requireAuth(request);
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

    const trackedJobIds = Array.from(
      new Set(
        (request.nextUrl.searchParams.get('jobIds') || '')
          .split(',')
          .map((value) => parseInt(value.trim(), 10))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    );

    // 3. Verify project exists and check access (owner OR member)
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },                            // Owner access
          { members: { some: { userId } } }      // Member access
        ]
      },
      select: { userId: true },
    });

    if (!project) {
      // Check if project exists at all
      const projectExists = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!projectExists) {
        return NextResponse.json(
          { error: 'Not Found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Forbidden', code: 'PROJECT_NOT_OWNED' },
        { status: 403 }
      );
    }

    // Default behavior keeps the payload focused on active jobs.
    // Clients may also pass `jobIds` to keep tracking specific jobs until they reach
    // a terminal status, which avoids stale UI state without returning full history.
    //
    // Ticketless jobs (e.g. admin insights-analyze runs which set ticketId=null
    // on the host project) are excluded so the response stays compatible with
    // the project-scoped polling contract — clients filter by ticketId and the
    // schema requires ticketId to be a positive integer.
    const jobs = await prisma.job.findMany({
      where: {
        projectId,
        ticketId: { not: null },
        OR: [
          { status: { in: ['PENDING', 'RUNNING'] } },
          ...(trackedJobIds.length > 0
            ? [{ id: { in: trackedJobIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        status: true,
        ticketId: true,
        command: true, // Required for dual job filtering (workflow vs AI-BOARD)
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 5. Transform to response format (ISO 8601 timestamps).
    // The WHERE clause already filtered out null ticketIds, but the Prisma
    // type still permits null, so the explicit check below keeps the schema
    // validator happy without changing observable behavior.
    const response = {
      jobs: jobs.flatMap(job =>
        job.ticketId === null
          ? []
          : [
              {
                id: job.id,
                status: job.status,
                ticketId: job.ticketId,
                command: job.command,
                updatedAt: job.updatedAt.toISOString(),
              },
            ]
      ),
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
