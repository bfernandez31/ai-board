import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { serializeOutcome } from '@/lib/outcomes/serialize';
import type { Prisma, WorkflowType } from '@prisma/client';

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'must be ISO-8601',
});

const querySchema = z.object({
  frictionFree: z.enum(['true', 'false']).optional(),
  partial: z.enum(['true', 'false']).optional(),
  domain: z.string().min(1).optional(),
  workflowType: z.enum(['FULL', 'QUICK', 'CLEAN']).optional(),
  since: isoDate.optional(),
  until: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.coerce.number().int().positive().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    await verifyProjectAccess(projectId, request);

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(rawQuery);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: first?.message ?? 'Invalid query',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    const q = parsed.data;

    const where: Prisma.TicketOutcomeWhereInput = { projectId };
    if (q.frictionFree !== undefined) where.frictionFree = q.frictionFree === 'true';
    if (q.partial !== undefined) where.partial = q.partial === 'true';
    if (q.workflowType !== undefined) where.workflowType = q.workflowType as WorkflowType;
    if (q.domain !== undefined) where.domains = { has: q.domain };
    if (q.since !== undefined || q.until !== undefined) {
      where.shippedAt = {};
      if (q.since !== undefined) where.shippedAt.gte = new Date(q.since);
      if (q.until !== undefined) where.shippedAt.lt = new Date(q.until);
    }

    const rows = await prisma.ticketOutcome.findMany({
      where,
      orderBy: { id: 'desc' },
      take: q.limit,
      include: { ticket: { select: { ticketKey: true } } },
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const outcomes = rows.map((row) =>
      serializeOutcome(row, { ticketKey: row.ticket.ticketKey })
    );
    const nextCursor =
      outcomes.length === q.limit ? outcomes[outcomes.length - 1]!.id : null;

    return NextResponse.json({
      outcomes,
      nextCursor,
      totalReturned: outcomes.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }
    if (message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[api/outcomes] error', err);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
