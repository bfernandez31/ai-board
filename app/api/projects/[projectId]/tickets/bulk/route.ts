import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { bulkActionSchema } from '@/lib/validations/bulk-actions';
import { bulkDeleteInboxTickets } from '@/lib/tickets/deletion';
import { mergeInboxTickets } from '@/lib/tickets/merge';
import { bulkUpdateAgent, bulkUpdateModel } from '@/lib/tickets/bulk-update';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectIdResult = ProjectIdSchema.safeParse(params.projectId);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(params.projectId, 10);
    await verifyProjectAccess(projectId, request);

    const body = await request.json();
    const parsed = bulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const action = parsed.data;

    switch (action.action) {
      case 'delete': {
        const result = await bulkDeleteInboxTickets(projectId, action.ticketIds);
        return NextResponse.json({ action: 'delete', ...result });
      }

      case 'merge': {
        try {
          const result = await mergeInboxTickets(
            projectId,
            action.ticketIds,
            action.mergedTitle,
            action.mergedDescription,
            action.selectedAttachments
          );
          return NextResponse.json({ action: 'merge', ...result });
        } catch (mergeError: unknown) {
          if (mergeError instanceof Error && 'status' in mergeError) {
            const status = (mergeError as { status: number }).status;
            return NextResponse.json(
              { error: mergeError.message, code: 'MERGE_ERROR' },
              { status }
            );
          }
          throw mergeError;
        }
      }

      case 'update-agent': {
        const result = await bulkUpdateAgent(projectId, action.ticketIds, action.agent);
        return NextResponse.json({ action: 'update-agent', ...result });
      }

      case 'update-model': {
        const result = await bulkUpdateModel(projectId, action.ticketIds, action.model);
        return NextResponse.json({ action: 'update-model', ...result });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action', code: 'UNKNOWN_ACTION' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    if (error instanceof Response) {
      const body = await error.json().catch(() => ({}));
      return NextResponse.json(
        body as Record<string, unknown>,
        { status: error.status }
      );
    }
    console.error('Bulk operation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
