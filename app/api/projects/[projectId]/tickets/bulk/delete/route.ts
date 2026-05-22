import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { bulkDeleteSchema } from '@/lib/validations/bulk';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { bulkDeleteInbox, BulkConflictError } from '@/lib/tickets/bulk-operations';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const projectId = parseInt(projectIdString, 10);

    await verifyProjectAccess(projectId, request);
    const actorId = await requireAuth(request);

    const body = await request.json();
    if (Array.isArray(body?.ticketIds) && body.ticketIds.length > 50) {
      return NextResponse.json(
        {
          error: 'Select at most 50 tickets per bulk action',
          code: 'BULK_LIMIT_EXCEEDED',
        },
        { status: 400 }
      );
    }
    const parseResult = bulkDeleteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }
    const { ticketIds, expectedVersions } = parseResult.data;

    console.log(
      `[bulk-action] start delete actor=${actorId} project=${projectId} count=${ticketIds.length}`
    );

    try {
      const result = await prisma.$transaction(async (tx) => {
        const op = await bulkDeleteInbox(tx, {
          projectId,
          ticketIds,
          expectedVersions: expectedVersions as Record<string, number>,
          actorId,
        });
        if (!op.ok) {
          throw new BulkConflictError(op.status, op.body);
        }
        return op.data;
      });

      console.log(
        `[bulk-action] done delete actor=${actorId} project=${projectId} count=${result.deleted.count}`
      );
      return NextResponse.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof BulkConflictError) {
        return NextResponse.json(err.body, { status: err.status });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized')
        return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      if (error.message === 'Project not found')
        return NextResponse.json({ error: 'Project not found', code: 'FORBIDDEN_PROJECT' }, { status: 403 });
    }
    console.error('Bulk delete failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete tickets', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
