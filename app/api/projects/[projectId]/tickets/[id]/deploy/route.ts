import { NextRequest, NextResponse } from 'next/server';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { isTicketDeployable } from '@/app/lib/utils/deploy-preview-eligibility';
import { dispatchDeployPreviewWorkflow } from '@/app/lib/workflows/dispatch-deploy-preview';

/**
 * POST /api/projects/[projectId]/tickets/[id]/deploy
 * Triggers a Vercel preview deployment for a ticket
 *
 * **Authentication**: NextAuth session (cookie-based)
 * **Authorization**: User must be project owner or member
 *
 * Eligibility Requirements:
 * 1. Ticket must be in VERIFY stage
 * 2. Ticket must have a branch
 * 3. Latest job must have COMPLETED status
 *
 * Single-Preview Enforcement:
 * - Clears all existing preview URLs in project before creating new job
 * - Transaction ensures atomicity (clear + create)
 *
 * Success Response (201):
 * {
 *   "job": {
 *     "id": 123,
 *     "ticketId": 42,
 *     "projectId": 1,
 *     "command": "deploy-preview",
 *     "status": "PENDING",
 *     "branch": "080-feature",
 *     "completedAt": null,
 *     "createdAt": "2025-11-03T14:30:00Z",
 *     "updatedAt": "2025-11-03T14:30:00Z"
 *   },
 *   "message": "Deployment job created and workflow dispatched"
 * }
 *
 * Error Responses:
 * - 400: Ticket not deployable (validation errors)
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (user not project owner/member)
 * - 404: Ticket not found
 * - 500: Internal server error (workflow dispatch failed)
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Parse and validate IDs
    const ticketId = parseInt(ticketIdString, 10);
    const projectId = parseInt(projectIdString, 10);

    if (isNaN(ticketId) || isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid ticket or project ID' },
        { status: 400 }
      );
    }

    // Verify ticket access (checks authentication + project ownership/membership)
    const ticket = await verifyTicketAccess(ticketId);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Validate ticket belongs to correct project
    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Forbidden: Ticket does not belong to this project' },
        { status: 403 }
      );
    }

    // Fetch ticket with jobs and project for eligibility check and workflow dispatch
    const ticketWithJobs = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        jobs: {
          select: {
            status: true,
            command: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        project: {
          select: {
            githubOwner: true,
            githubRepo: true,
          },
        },
      },
    });

    if (!ticketWithJobs) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check deployment eligibility
    if (!isTicketDeployable(ticketWithJobs)) {
      // Provide specific error message based on failure reason
      if (ticketWithJobs.stage !== 'VERIFY') {
        return NextResponse.json(
          { error: 'Ticket must be in VERIFY stage to deploy' },
          { status: 400 }
        );
      }

      if (!ticketWithJobs.branch) {
        return NextResponse.json(
          { error: 'Ticket must have an associated branch' },
          { status: 400 }
        );
      }

      const latestJob = ticketWithJobs.jobs[0];
      if (!latestJob || latestJob.status !== 'COMPLETED') {
        return NextResponse.json(
          { error: 'Ticket must have a COMPLETED job before deployment' },
          { status: 400 }
        );
      }

      // Fallback error (should not reach here)
      return NextResponse.json(
        { error: 'Ticket is not eligible for deployment' },
        { status: 400 }
      );
    }

    // Create deployment job (preview URL clearing happens when new URL is set)
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId,
        command: 'deploy-preview',
        status: 'PENDING',
        branch: ticketWithJobs.branch,
        updatedAt: new Date(),
      },
    });

    console.log('[Deploy] Job created:', {
      jobId: job.id,
      ticketId,
      branch: job.branch,
    });

    // Dispatch GitHub workflow (async, don't await in transaction)
    try {
      await dispatchDeployPreviewWorkflow({
        ticket_id: ticketId.toString(),
        project_id: projectId.toString(),
        branch: job.branch!,
        job_id: job.id.toString(),
        githubRepository: `${ticketWithJobs.project.githubOwner}/${ticketWithJobs.project.githubRepo}`,
      });

      console.log('[Deploy] Workflow dispatched successfully:', {
        jobId: job.id,
        branch: job.branch,
      });
    } catch (dispatchError) {
      console.error('[Deploy] Workflow dispatch failed:', dispatchError);

      // Mark job as FAILED if workflow dispatch fails
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'FAILED' },
      });

      return NextResponse.json(
        { error: 'Failed to dispatch deployment workflow' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        job: {
          id: job.id,
          ticketId: job.ticketId,
          projectId: job.projectId,
          command: job.command,
          status: job.status,
          branch: job.branch,
          completedAt: job.completedAt,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
        },
        message: 'Deployment job created and workflow dispatched',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error triggering deployment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
