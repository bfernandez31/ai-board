import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { prisma } from '@/lib/db/client';

const statusBodySchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  workflowRunId: z
    .union([z.string().regex(/^\d+$/), z.number().int().positive()])
    .optional(),
  artifactKey: z.string().max(300).optional(),
  artifactSize: z.number().int().nonnegative().optional(),
  errorMessage: z.string().max(2000).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idString } = await context.params;
  const id = parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = statusBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const payload = parsed.data;

  const existing = await prisma.insightsReport.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const data: Record<string, unknown> = {
    status: payload.status,
  };
  if (payload.workflowRunId !== undefined) {
    data.workflowRunId = BigInt(payload.workflowRunId);
  }
  if (payload.artifactKey !== undefined) {
    data.artifactKey = payload.artifactKey;
  }
  if (payload.artifactSize !== undefined) {
    data.artifactSize = payload.artifactSize;
  }
  if (payload.errorMessage !== undefined) {
    data.errorMessage = payload.errorMessage;
  }
  if (payload.status === 'COMPLETED' || payload.status === 'FAILED') {
    data.completedAt = new Date();
  }

  const updated = await prisma.insightsReport.update({
    where: { id },
    data,
    select: {
      id: true,
      status: true,
      artifactKey: true,
      artifactSize: true,
      errorMessage: true,
      completedAt: true,
    },
  });

  return NextResponse.json(
    {
      id: updated.id,
      status: updated.status,
      artifactKey: updated.artifactKey,
      artifactSize: updated.artifactSize,
      errorMessage: updated.errorMessage,
      completedAt: updated.completedAt?.toISOString() ?? null,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
