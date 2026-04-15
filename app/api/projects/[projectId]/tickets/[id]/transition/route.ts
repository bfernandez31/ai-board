import { NextRequest, NextResponse } from 'next/server';
import { Stage } from '@prisma/client';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { executeTicketTransition } from '@/lib/tickets/transition';

const TransitionRequestSchema = z.object({
  targetStage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdentifier } = params;
    const projectId = parseInt(projectIdString, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const isWorkflowAuth = await verifyWorkflowToken(request);
    if (!isWorkflowAuth) {
      try {
        await verifyProjectAccess(projectId, request);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Unauthorized') {
            return NextResponse.json(
              { error: 'Unauthorized', code: 'AUTH_ERROR' },
              { status: 401 }
            );
          }
          if (error.message === 'Project not found') {
            return NextResponse.json(
              { error: 'Project not found', code: 'NOT_FOUND' },
              { status: 404 }
            );
          }
        }
        throw error;
      }
    }

    const body = await request.json();
    const parseResult = TransitionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { targetStage } = parseResult.data;

    const result = await executeTicketTransition(
      projectId,
      ticketIdentifier,
      targetStage as Stage
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error transitioning ticket:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (error.message === 'Project not found') return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      if (error.message === 'Ticket not found') return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
