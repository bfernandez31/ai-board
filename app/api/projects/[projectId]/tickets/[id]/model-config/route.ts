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
    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    await verifyTicketAccess(ticketId, request);

    const body = await request.json();
    const validated = ticketModelOverrideSchema.parse(body);

    const updateData: Record<string, string | null> = {};
    if (validated.resetAll) {
      for (const key of STAGE_MODEL_KEYS) {
        updateData[key] = null;
      }
    } else {
      if (validated.specifyModel !== undefined) updateData.specifyModel = validated.specifyModel;
      if (validated.planModel !== undefined) updateData.planModel = validated.planModel;
      if (validated.implementModel !== undefined) updateData.implementModel = validated.implementModel;
      if (validated.quickImplModel !== undefined) updateData.quickImplModel = validated.quickImplModel;
      if (validated.verifyModel !== undefined) updateData.verifyModel = validated.verifyModel;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
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

    return NextResponse.json({
      ticketId: updated.id,
      specifyModel: updated.specifyModel,
      planModel: updated.planModel,
      implementModel: updated.implementModel,
      quickImplModel: updated.quickImplModel,
      verifyModel: updated.verifyModel,
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
