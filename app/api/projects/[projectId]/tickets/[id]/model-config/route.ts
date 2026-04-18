import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { ticketModelOverrideSchema } from '@/app/lib/schemas/model-config';
import { STAGE_MODEL_KEYS, STAGE_MODEL_LABELS } from '@/lib/models/claude-models';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdParam, id } = await params;
    const ticketId = parseInt(id, 10);
    const projectId = parseInt(projectIdParam, 10);

    if (isNaN(ticketId) || isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid ticket or project ID' },
        { status: 400 }
      );
    }

    await verifyTicketAccess(ticketId, request);

    const body = await request.json();
    const validated = ticketModelOverrideSchema.parse(body);

    const updateData: Record<string, string | null> = {};
    for (const key of STAGE_MODEL_KEYS) {
      if (validated.resetAll) {
        updateData[key] = null;
      } else if (validated[key] !== undefined) {
        updateData[key] = validated[key] ?? null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field must be provided' },
        { status: 400 }
      );
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId, projectId },
      data: updateData,
      select: {
        id: true,
        specifyModel: true,
        planModel: true,
        implementModel: true,
        quickImplModel: true,
        verifyModel: true,
      },
    });

    const overriddenStages = STAGE_MODEL_KEYS
      .filter((key) => updated[key] != null)
      .map((key) => STAGE_MODEL_LABELS[key]);

    const { id: updatedId, ...models } = updated;
    return NextResponse.json({
      ticketId: updatedId,
      ...models,
      hasAnyOverride: overriddenStages.length > 0,
      overriddenStages,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const modelFieldIssue = error.issues.find((issue) =>
        typeof issue.path[0] === 'string' &&
        ['specifyModel', 'planModel', 'implementModel', 'quickImplModel', 'verifyModel'].includes(
          issue.path[0] as string
        )
      );
      if (modelFieldIssue) {
        return NextResponse.json(
          { error: modelFieldIssue.message, code: 'INVALID_MODEL_ID', issues: error.issues },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Validation failed', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (
      error instanceof Error &&
      (error.message === 'Authentication required' || error.message === 'Unauthorized')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Ticket model-config PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
