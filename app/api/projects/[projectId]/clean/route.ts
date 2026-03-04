import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  shouldRunCleanup,
  generateCleanupDescription,
} from '@/lib/db/cleanup-analysis';
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';
import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

/**
 * POST /api/projects/[projectId]/clean
 * Trigger cleanup workflow for a project
 *
 * New diff-based approach:
 * 1. Find last cleanup merge point
 * 2. Analyze all changes since then (not per-branch)
 * 3. Check for dead code, project impact, spec sync
 *
 * @param _request - Next.js request object (unused)
 * @param context - Route context with projectId parameter
 * @returns 201 with cleanup ticket and job, 409 if cleanup already in progress, 400 if nothing to clean
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const projectId = parseInt((await context.params).projectId);

    // Authorization check
    const project = await verifyProjectAccess(projectId);

    // Check if there's already an active cleanup job (409 Conflict)
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeCleanupJobId: true, key: true },
    });

    if (existingProject?.activeCleanupJobId) {
      const existingJob = await prisma.job.findUnique({
        where: { id: existingProject.activeCleanupJobId },
        select: { status: true, id: true },
      });

      if (existingJob && ['PENDING', 'RUNNING'].includes(existingJob.status)) {
        return NextResponse.json(
          {
            error: 'Cleanup workflow already in progress',
            code: 'CLEANUP_ALREADY_RUNNING',
            details: {
              activeJobId: existingJob.id,
              activeJobStatus: existingJob.status,
            },
          },
          { status: 409 }
        );
      }
    }

    // Check if cleanup should run (based on shipped tickets since last cleanup)
    const cleanupCheck = await shouldRunCleanup(projectId);

    if (!cleanupCheck.shouldRun) {
      return NextResponse.json(
        {
          error: 'No changes to clean up',
          code: 'NO_CHANGES',
          details: {
            lastCleanupDate: cleanupCheck.lastCleanup.date.toISOString(),
            lastCleanupTicket: cleanupCheck.lastCleanup.ticketKey,
            message: cleanupCheck.reason,
          },
        },
        { status: 400 }
      );
    }

    // Generate cleanup description
    const description = generateCleanupDescription(
      cleanupCheck.lastCleanup,
      cleanupCheck.changes
    );

    // Create cleanup ticket + job + set activeCleanupJobId atomically
    const result = await prisma.$transaction(async (tx) => {
      // Generate next ticket number
      const ticketNumber = await getNextTicketNumber(projectId);
      const ticketKey = `${existingProject!.key}-${ticketNumber}`;

      // Create cleanup ticket
      const cleanupTicket = await tx.ticket.create({
        data: {
          title: `Clean ${new Date().toISOString().split('T')[0]}`,
          description,
          stage: 'BUILD',
          workflowType: 'CLEAN',
          projectId,
          ticketNumber,
          ticketKey,
          autoMode: false,
          updatedAt: new Date(),
        },
      });

      // Create cleanup job
      const job = await tx.job.create({
        data: {
          ticketId: cleanupTicket.id,
          projectId,
          command: 'clean',
          status: 'PENDING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Set activeCleanupJobId to lock transitions
      await tx.project.update({
        where: { id: projectId },
        data: { activeCleanupJobId: job.id },
      });

      return { ticket: cleanupTicket, job };
    });

    // Dispatch cleanup workflow on ai-board repository (centralized workflows)
    const githubToken = process.env.GITHUB_TOKEN;
    const aiboardOwner = process.env.GITHUB_OWNER;
    const aiboardRepo = process.env.GITHUB_REPO;
    const targetRepository = `${project.githubOwner}/${project.githubRepo}`;

    if (isWorkflowTestMode(githubToken)) {
      console.log('[Cleanup Workflow Dispatch] Skipping in test mode:', {
        ticketKey: result.ticket.ticketKey,
      });
    } else if (!aiboardOwner || !aiboardRepo) {
      console.error('Missing GITHUB_OWNER or GITHUB_REPO environment variables');
    } else {
      try {
        const octokit = new Octokit({ auth: githubToken });

        console.log('[Cleanup Workflow Dispatch]', {
          aiboardRepo: `${aiboardOwner}/${aiboardRepo}`,
          targetRepo: targetRepository,
          ticketKey: result.ticket.ticketKey,
        });

        await octokit.actions.createWorkflowDispatch({
          owner: aiboardOwner,
          repo: aiboardRepo,
          workflow_id: 'cleanup.yml',
          ref: 'main',
          inputs: {
            ticket_id: result.ticket.ticketKey,
            project_id: projectId.toString(),
            job_id: result.job.id.toString(),
            githubRepository: targetRepository,
          },
        });
      } catch (dispatchError) {
        console.error('Error dispatching cleanup workflow:', dispatchError);
        // Don't fail the request - workflow can be manually triggered
      }
    }

    // Return success response
    return NextResponse.json(
      {
        ticket: {
          id: result.ticket.id,
          ticketKey: result.ticket.ticketKey,
          title: result.ticket.title,
          description: result.ticket.description,
          stage: result.ticket.stage,
          workflowType: result.ticket.workflowType,
          branch: result.ticket.branch,
          projectId: result.ticket.projectId,
          createdAt: result.ticket.createdAt.toISOString(),
        },
        job: {
          id: result.job.id,
          ticketId: result.job.ticketId,
          command: result.job.command,
          status: result.job.status,
          branch: result.job.branch,
          startedAt: result.job.startedAt.toISOString(),
          projectId: result.job.projectId,
        },
        analysis: {
          lastCleanup: cleanupCheck.lastCleanup,
          changes: cleanupCheck.changes,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error triggering cleanup:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to trigger cleanup',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
