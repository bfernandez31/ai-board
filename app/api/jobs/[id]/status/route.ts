import { NextRequest, NextResponse } from 'next/server';
import { jobStatusUpdateSchema } from '@/app/lib/job-update-validator';
import {
  canTransition,
  InvalidTransitionError,
  JobStatus,
} from '@/app/lib/job-state-machine';
import { broadcastJobStatusUpdate } from '@/lib/sse-broadcast';
import type { JobStatusUpdate } from '@/lib/sse-schemas';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';

/**
 * PATCH /api/jobs/[id]/status
 * Update Job status during and after GitHub Actions workflow execution
 *
 * This endpoint is called by GitHub Actions workflows to update job status
 * when starting (RUNNING) and upon completion (COMPLETED, FAILED, CANCELLED).
 *
 * Request Body:
 * {
 *   "status": "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "status": "COMPLETED",
 *   "completedAt": "2025-10-10T14:32:15.123Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid request (validation error or invalid state transition)
 * - 404: Job not found
 * - 500: Internal server error
 *
 * Features:
 * - Idempotent: Requesting same status returns 200 with current state
 * - State machine validation: Prevents invalid transitions
 * - Minimal response: Only id, status, completedAt
 * - Error logging: All failures logged for debugging
 *
 * @see specs/019-update-job-on/contracts/job-update-api.yaml for API contract
 * @see specs/019-update-job-on/data-model.md for state machine rules
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const startTime = Date.now();
  let jobId: number | undefined;
  let currentStatus: JobStatus | undefined;
  let requestedStatus: JobStatus | undefined;

  try {
    // Validate workflow authentication
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Job Status Update] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract and validate job ID from URL
    const params = await context.params;
    const { id: jobIdString } = params;

    jobId = parseInt(jobIdString, 10);
    if (isNaN(jobId)) {
      console.error('[Job Status Update] Invalid job ID format:', jobIdString);
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body with Zod
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Job Status Update] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = jobStatusUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      const zodErrors = validationResult.error.issues;
      console.error('[Job Status Update] Validation failed:', {
        jobId,
        body,
        errors: zodErrors,
      });

      return NextResponse.json(
        {
          error: 'Invalid request',
          details: zodErrors.map((err) => ({
            message: err.message,
            path: err.path,
          })),
        },
        { status: 400 }
      );
    }

    requestedStatus = validationResult.data.status as JobStatus;

    // Fetch current job from database
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        completedAt: true,
        startedAt: true,
      },
    });

    if (!job) {
      console.error('[Job Status Update] Job not found:', { jobId });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    currentStatus = job.status as JobStatus;

    // Check if this is an idempotent request (same status)
    if (currentStatus === requestedStatus) {
      const elapsedTime = Date.now() - startTime;
      console.log('[Job Status Update] Idempotent request (no-op):', {
        jobId,
        status: currentStatus,
        elapsedMs: elapsedTime,
      });

      // Return success with current state (no database update)
      return NextResponse.json(
        {
          id: job.id,
          status: job.status,
          completedAt: job.completedAt?.toISOString() || null,
        },
        { status: 200 }
      );
    }

    // Validate state transition using state machine
    if (!canTransition(currentStatus, requestedStatus)) {
      const errorMessage = `Invalid transition from ${currentStatus} to ${requestedStatus}`;
      console.error('[Job Status Update] Invalid state transition:', {
        jobId,
        currentStatus,
        requestedStatus,
        error: errorMessage,
      });

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Update job status and set timestamps appropriately
    // completedAt is only set for terminal states (COMPLETED/FAILED/CANCELLED)
    // Include ticket relation to get projectId for SSE broadcast
    const isTerminalState = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(requestedStatus);

    // Build update data dynamically to satisfy exactOptionalPropertyTypes: true
    // Cannot pass undefined explicitly, must omit the field entirely
    const updateData: {
      status: JobStatus;
      startedAt?: Date;
      completedAt?: Date;
    } = {
      status: requestedStatus,
    };

    if (requestedStatus === 'RUNNING' && !job.startedAt) {
      updateData.startedAt = new Date();
    }

    if (isTerminalState) {
      updateData.completedAt = new Date();
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      select: {
        id: true,
        status: true,
        completedAt: true,
        ticketId: true,
        command: true,
        ticket: {
          select: {
            projectId: true,
          },
        },
      },
    });

    const elapsedTime = Date.now() - startTime;
    console.log('[Job Status Update] Success:', {
      jobId,
      transition: `${currentStatus} → ${requestedStatus}`,
      completedAt: updatedJob.completedAt?.toISOString(),
      elapsedMs: elapsedTime,
    });

    // Broadcast job status update to SSE clients
    try {
      const broadcastMessage: JobStatusUpdate = {
        projectId: updatedJob.ticket.projectId,
        ticketId: updatedJob.ticketId,
        jobId: updatedJob.id,
        status: updatedJob.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
        command: updatedJob.command,
        timestamp: new Date().toISOString(),
      };

      await broadcastJobStatusUpdate(broadcastMessage);
      console.log('[Job Status Update] SSE broadcast sent');
    } catch (broadcastError) {
      // Log broadcast error but don't fail the API request
      // The database update succeeded, which is the critical operation
      console.error('[Job Status Update] SSE broadcast failed:', {
        jobId,
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
      });
    }

    // Return minimal response (id, status, completedAt)
    return NextResponse.json(
      {
        id: updatedJob.id,
        status: updatedJob.status,
        completedAt: updatedJob.completedAt?.toISOString() || null,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;

    // Log comprehensive error details for debugging
    console.error('[Job Status Update] Unexpected error:', {
      jobId,
      currentStatus,
      requestedStatus,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs: elapsedTime,
    });

    // Handle specific error types
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Generic internal server error
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
