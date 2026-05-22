import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { bulkActionSchema } from '@/lib/validations/bulk-actions';
import { bulkDeleteInboxTickets } from '@/lib/tickets/deletion';

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
        return NextResponse.json(
          { error: 'Not implemented', code: 'NOT_IMPLEMENTED' },
          { status: 501 }
        );
      }

      case 'update-agent': {
        return NextResponse.json(
          { error: 'Not implemented', code: 'NOT_IMPLEMENTED' },
          { status: 501 }
        );
      }

      case 'update-model': {
        return NextResponse.json(
          { error: 'Not implemented', code: 'NOT_IMPLEMENTED' },
          { status: 501 }
        );
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
