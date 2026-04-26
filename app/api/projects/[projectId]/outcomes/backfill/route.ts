/**
 * POST /api/projects/[projectId]/outcomes/backfill
 *
 * Run a backfill pass over historical shipped tickets in the project that
 * don't yet have an outcome record. Idempotent and resumable — re-running
 * after a partial failure picks up only the missing rows.
 *
 * Owner-only: backfill makes external API calls and consumes rate-limit
 * budget, so we restrict it to project owners (not members).
 *
 * Body (optional JSON):
 *   - limit: number — process at most N tickets in this pass (chunked runs)
 *   - delayMs: number — sleep between GitHub-touching captures (default 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { backfillProjectOutcomes } from '@/lib/outcomes/backfill';

const BodySchema = z
  .object({
    limit: z.number().int().positive().max(1000).optional(),
    delayMs: z.number().int().min(0).max(5000).optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    let body: z.infer<typeof BodySchema> = {};
    try {
      const raw = await request.text();
      if (raw.trim()) body = BodySchema.parse(JSON.parse(raw));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request body', issues: err.issues },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = await backfillProjectOutcomes(projectId, {
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
      ...(body.delayMs !== undefined ? { delayMs: body.delayMs } : {}),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('Error running outcome backfill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
