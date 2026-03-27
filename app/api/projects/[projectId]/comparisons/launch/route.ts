/**
 * Launch Comparison API Route
 *
 * POST /api/projects/:projectId/comparisons/launch
 * Launch a new comparison by selecting VERIFY-stage tickets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { dispatchAIBoardWorkflow } from '@/app/lib/workflows/dispatch-ai-board';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const launchSchema = z.object({
  ticketIds: z
    .array(z.number().int().positive())
    .min(2, 'At least 2 tickets required')
    .max(5, 'Maximum 5 tickets allowed')
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate ticket IDs not allowed'),
});

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    let project;
    try {
      project = await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await requireAuth();

    const body = await request.json();
    const parseResult = launchSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message ?? 'Invalid request body';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { ticketIds } = parseResult.data;

    // Verify all tickets exist, belong to this project, are in VERIFY stage, and have branches
    const tickets = await prisma.ticket.findMany({
      where: {
        id: { in: ticketIds },
        projectId: projectIdNum,
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
        branch: true,
        agent: true,
      },
    });

    // Check all tickets were found
    for (const ticketId of ticketIds) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return NextResponse.json(
          { error: `Ticket not found: ${ticketId}` },
          { status: 404 }
        );
      }
      if (ticket.stage !== 'VERIFY') {
        return NextResponse.json(
          { error: `Ticket ${ticket.ticketKey} is not in VERIFY stage` },
          { status: 400 }
        );
      }
      if (!ticket.branch) {
        return NextResponse.json(
          { error: `Ticket ${ticket.ticketKey} has no branch` },
          { status: 400 }
        );
      }
    }

    // Use the first ticket as the "source" ticket
    const sourceTicket = tickets.find((t) => t.id === ticketIds[0])!;
    const participantTicketKeys = tickets.map((t) => t.ticketKey);

    // Construct the compare command text
    const compareCommand = `@ai-board /compare ${participantTicketKeys.join(' ')}`;

    // Create Job record
    const job = await prisma.job.create({
      data: {
        ticketId: sourceTicket.id,
        projectId: projectIdNum,
        command: 'comment-verify',
        status: 'PENDING',
        branch: sourceTicket.branch,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Dispatch workflow
    try {
      await dispatchAIBoardWorkflow({
        ticket_id: sourceTicket.id.toString(),
        stage: 'verify',
        branch: sourceTicket.branch!,
        user_id: userId,
        user: userId,
        comment: compareCommand,
        job_id: job.id.toString(),
        project_id: projectIdNum.toString(),
        githubRepository: `${project.githubOwner}/${project.githubRepo}`,
        agent: sourceTicket.agent ?? 'CLAUDE',
      });
    } catch (workflowError) {
      console.error('[comparisons/launch] Failed to dispatch workflow:', workflowError);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'FAILED', completedAt: new Date(), updatedAt: new Date() },
      });
      return NextResponse.json(
        { error: 'Failed to dispatch comparison workflow' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: 'PENDING',
        sourceTicketKey: sourceTicket.ticketKey,
        participantTicketKeys,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error launching comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
