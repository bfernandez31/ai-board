import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { bulkMergeTickets } from '@/lib/db/tickets';
import { ProjectIdSchema, bulkMergeDraftSchema } from '@/lib/validations/ticket';

function bulkRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
  }

  if (error instanceof Error && error.message === 'Project not found') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  console.error('Bulk ticket merge route error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdParam } = await context.params;
    const projectIdResult = ProjectIdSchema.parse(projectIdParam);
    const projectId = parseInt(projectIdResult, 10);

    await verifyProjectAccess(projectId, request);
    const body = bulkMergeDraftSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const mergeResult = await bulkMergeTickets(tx, projectId, body);
      if (!mergeResult.ok) {
        return NextResponse.json(
          { error: 'Bulk action blocked', code: 'BULK_ACTION_BLOCKED', details: mergeResult.details },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        survivor: {
          id: mergeResult.survivor.id,
          ticketKey: mergeResult.survivor.ticketKey,
          title: mergeResult.survivor.title,
          description: mergeResult.survivor.description,
          attachments: mergeResult.survivor.attachments,
          stage: mergeResult.survivor.stage,
          version: mergeResult.survivor.version,
          projectId: mergeResult.survivor.projectId,
          agent: mergeResult.survivor.agent,
          specifyModel: mergeResult.survivor.specifyModel,
          planModel: mergeResult.survivor.planModel,
          implementModel: mergeResult.survivor.implementModel,
          quickImplModel: mergeResult.survivor.quickImplModel,
          verifyModel: mergeResult.survivor.verifyModel,
          createdAt: mergeResult.survivor.createdAt.toISOString(),
          updatedAt: mergeResult.survivor.updatedAt.toISOString(),
        },
        deletedSourceTicketIds: mergeResult.deletedSourceTicketIds,
      });
    });

    return result;
  } catch (error) {
    return bulkRouteError(error);
  }
}
