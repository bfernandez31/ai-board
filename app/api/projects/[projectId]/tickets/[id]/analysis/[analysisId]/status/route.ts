import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { AnalysisOutputSchema, ColdStartOutputSchema } from '@/lib/analysis/output-schema';
import { AnalysisErrorReason, ColdStartReason } from '@/lib/analysis/types';

export const dynamic = 'force-dynamic';

const TelemetrySchema = z
  .object({
    costUsd: z.number().min(0),
    durationMs: z.number().int().min(0),
    inputTokens: z.number().int().min(0).optional(),
    outputTokens: z.number().int().min(0).optional(),
    thinkingTokens: z.number().int().min(0).optional(),
    cacheReadTokens: z.number().int().min(0).optional(),
  })
  .strict();

const StatusUpdateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    output: AnalysisOutputSchema,
    telemetry: TelemetrySchema,
  }),
  z.object({
    status: z.literal('cold_start'),
    coldStartReason: ColdStartReason,
    output: ColdStartOutputSchema,
    telemetry: TelemetrySchema,
  }),
  z.object({
    status: z.literal('failed'),
    errorReason: AnalysisErrorReason,
    errorMessage: z.string().max(2000).optional(),
  }),
]);

function noStore(json: unknown, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(json, init);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; id: string; analysisId: string }> }
) {
  try {
    const auth = validateWorkflowAuth(request);
    if (!auth.isValid) {
      return noStore({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { projectId: projectIdStr, id: ticketIdStr, analysisId: analysisIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    const ticketId = parseInt(ticketIdStr, 10);
    const analysisId = parseInt(analysisIdStr, 10);
    if (
      isNaN(projectId) ||
      projectId <= 0 ||
      isNaN(ticketId) ||
      ticketId <= 0 ||
      isNaN(analysisId) ||
      analysisId <= 0
    ) {
      return noStore({ error: 'Invalid IDs', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = StatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return noStore(
        { error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const row = await prisma.ticketAnalysis.findFirst({
      where: { id: analysisId, projectId, ticketId },
    });
    if (!row) {
      return noStore({ error: 'Analysis not found', code: 'ANALYSIS_NOT_FOUND' }, { status: 404 });
    }

    if (row.status !== 'running') {
      return noStore({
        analysis: {
          id: row.id,
          status: row.status,
          endedAt: row.endedAt ? row.endedAt.toISOString() : null,
        },
      });
    }

    if (data.status === 'success') {
      const attempted = new Set(row.anchorIdsAttempted);
      const invalid = data.output.anchors.find((a) => !attempted.has(a.ticketId));
      if (invalid) {
        return noStore(
          {
            error: `Anchor ticketId ${invalid.ticketId} not in candidate set`,
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    let updateData: Prisma.TicketAnalysisUpdateInput;
    if (data.status === 'success') {
      updateData = {
        status: 'success',
        endedAt: now,
        output: data.output as unknown as Prisma.InputJsonValue,
        costUsd: data.telemetry.costUsd,
        durationMs: data.telemetry.durationMs,
        inputTokens: data.telemetry.inputTokens ?? null,
        outputTokens: data.telemetry.outputTokens ?? null,
        thinkingTokens: data.telemetry.thinkingTokens ?? null,
        cacheReadTokens: data.telemetry.cacheReadTokens ?? null,
      };
    } else if (data.status === 'cold_start') {
      updateData = {
        status: 'cold_start',
        endedAt: now,
        coldStartReason: data.coldStartReason,
        output: data.output as unknown as Prisma.InputJsonValue,
        costUsd: data.telemetry.costUsd,
        durationMs: data.telemetry.durationMs,
        inputTokens: data.telemetry.inputTokens ?? null,
        outputTokens: data.telemetry.outputTokens ?? null,
        thinkingTokens: data.telemetry.thinkingTokens ?? null,
        cacheReadTokens: data.telemetry.cacheReadTokens ?? null,
      };
    } else {
      updateData = {
        status: 'failed',
        endedAt: now,
        errorReason: data.errorReason,
        errorMessage: data.errorMessage ?? null,
      };
    }

    const result = await prisma.ticketAnalysis.updateMany({
      where: { id: analysisId, status: 'running' },
      data: updateData as Prisma.TicketAnalysisUncheckedUpdateManyInput,
    });

    if (result.count === 0) {
      const fresh = await prisma.ticketAnalysis.findUnique({ where: { id: analysisId } });
      return noStore({
        analysis: fresh
          ? {
              id: fresh.id,
              status: fresh.status,
              endedAt: fresh.endedAt ? fresh.endedAt.toISOString() : null,
            }
          : null,
      });
    }

    const updated = await prisma.ticketAnalysis.findUnique({ where: { id: analysisId } });

    console.log(
      `[api/analysis] PATCH → id=${analysisId} status=${updated?.status} durationMs=${updated?.durationMs ?? 'n/a'}`
    );

    return noStore({
      analysis: updated
        ? {
            id: updated.id,
            status: updated.status,
            endedAt: updated.endedAt ? updated.endedAt.toISOString() : null,
          }
        : null,
    });
  } catch (error) {
    console.error('[api/analysis/status] PATCH error:', error);
    return noStore({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
