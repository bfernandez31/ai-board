import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { bulkMergeSchema } from '@/lib/validations/bulk';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { bulkMergeInbox, BulkConflictError } from '@/lib/tickets/bulk-operations';

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
    const parseResult = bulkMergeSchema.safeParse(body);
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
    const { baseTicketId, sourceTicketIds, title, description, expectedVersions } = parseResult.data;

    console.log(
      `[bulk-action] start merge actor=${actorId} project=${projectId} base=${baseTicketId} sources=${sourceTicketIds.length}`
    );

    try {
      const result = await prisma.$transaction(async (tx) => {
        const op = await bulkMergeInbox(tx, {
          projectId,
          baseTicketId,
          sourceTicketIds,
          title,
          description,
          expectedVersions: expectedVersions as Record<string, number>,
          actorId,
        });
        if (!op.ok) {
          throw new BulkConflictError(op.status, op.body);
        }
        return op.data;
      });

      console.log(
        `[bulk-action] done merge actor=${actorId} project=${projectId} base=${baseTicketId} deleted=${result.deleted.count}`
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
    console.error('Bulk merge failed:', error);
    return NextResponse.json(
      { error: 'Failed to merge tickets', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
