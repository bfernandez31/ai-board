import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import {
  ticketModelOverrideSchema,
  ticketCodexModelOverrideSchema,
} from '@/app/lib/schemas/model-config';
import { STAGE_MODEL_KEYS, STAGE_MODEL_LABELS } from '@/lib/models/claude-models';
import { CODEX_STAGE_MODEL_KEYS, CODEX_STAGE_MODEL_LABELS } from '@/lib/models/codex-models';

const ALL_MODEL_FIELD_NAMES: readonly string[] = [
  ...STAGE_MODEL_KEYS,
  ...CODEX_STAGE_MODEL_KEYS,
];

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

    const hasClaudeKey =
      body && typeof body === 'object' && STAGE_MODEL_KEYS.some((key) => key in body);
    const hasCodexKey =
      body && typeof body === 'object' && CODEX_STAGE_MODEL_KEYS.some((key) => key in body);

    if (hasClaudeKey && hasCodexKey) {
      return NextResponse.json(
        {
          error: 'Request mixes Claude and Codex model fields. Submit one agent\'s overrides at a time.',
          code: 'MIXED_AGENT_PAYLOAD',
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | null> = {};

    if (hasCodexKey) {
      const validated = ticketCodexModelOverrideSchema.parse(body);
      if (validated.resetAll) {
        for (const key of STAGE_MODEL_KEYS) updateData[key] = null;
        for (const key of CODEX_STAGE_MODEL_KEYS) updateData[key] = null;
      } else {
        for (const key of CODEX_STAGE_MODEL_KEYS) {
          if (validated[key] !== undefined) {
            updateData[key] = validated[key] ?? null;
          }
        }
      }
    } else {
      const validated = ticketModelOverrideSchema.parse(body);
      if (validated.resetAll) {
        for (const key of STAGE_MODEL_KEYS) updateData[key] = null;
        for (const key of CODEX_STAGE_MODEL_KEYS) updateData[key] = null;
      } else {
        for (const key of STAGE_MODEL_KEYS) {
          if (validated[key] !== undefined) {
            updateData[key] = validated[key] ?? null;
          }
        }
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
        codexSpecifyModel: true,
        codexPlanModel: true,
        codexImplementModel: true,
        codexQuickImplModel: true,
        codexVerifyModel: true,
      },
    });

    const overriddenStages: string[] = [];
    for (const key of STAGE_MODEL_KEYS) {
      if (updated[key] != null) overriddenStages.push(STAGE_MODEL_LABELS[key]);
    }
    for (const key of CODEX_STAGE_MODEL_KEYS) {
      if (updated[key] != null) {
        const label = CODEX_STAGE_MODEL_LABELS[key];
        if (!overriddenStages.includes(label)) overriddenStages.push(label);
      }
    }

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
        ALL_MODEL_FIELD_NAMES.includes(issue.path[0] as string)
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
