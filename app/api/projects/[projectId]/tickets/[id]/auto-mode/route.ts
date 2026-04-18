import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { enableAutoMode, disableAutoMode } from '@/app/lib/tickets/auto-mode';

const AutoModeRequestSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdentifier } = params;
    const projectId = parseInt(projectIdString, 10);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    try {
      await verifyProjectAccess(projectId, request);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (error.message === 'Project not found') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      throw error;
    }

    const body = await request.json().catch(() => null);
    const parsed = AutoModeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { enabled } = parsed.data;
    const result = enabled
      ? await enableAutoMode({ projectId, ticketIdentifier })
      : await disableAutoMode({ projectId, ticketIdentifier });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[Auto-Mode Route] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
