import { NextRequest, NextResponse } from 'next/server';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { isTicketDeployable } from '@/app/lib/utils/deploy-preview-eligibility';
import { dispatchDeployPreviewWorkflow } from '@/app/lib/workflows/dispatch-deploy-preview';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;
    const ticketId = parseInt(ticketIdString, 10);
    const projectId = parseInt(projectIdString, 10);

    if (isNaN(ticketId) || isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid ticket or project ID' },
        { status: 400 }
      );
    }

    const ticket = await verifyTicketAccess(ticketId);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Forbidden: Ticket does not belong to this project' },
        { status: 403 }
      );
    }

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

    if (!isTicketDeployable(ticketWithJobs)) {
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

      return NextResponse.json(
        { error: 'Ticket is not eligible for deployment' },
        { status: 400 }
      );
    }

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

    try {
      await dispatchDeployPreviewWorkflow({
        ticket_id: ticketId.toString(),
        project_id: projectId.toString(),
        branch: job.branch!,
        job_id: job.id.toString(),
        githubRepository: `${ticketWithJobs.project.githubOwner}/${ticketWithJobs.project.githubRepo}`,
      });

    } catch (dispatchError) {
      console.error('[Deploy] Workflow dispatch failed:', dispatchError);
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
