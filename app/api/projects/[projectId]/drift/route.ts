import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getDriftData } from '@/lib/drift/queries';
import type { DriftFilters } from '@/lib/drift/types';

const querySchema = z.object({
  cursor: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(30),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const filters: DriftFilters = { pageSize: parseResult.data.pageSize };
    if (parseResult.data.cursor) filters.cursor = parseResult.data.cursor;
    const data = await getDriftData(projectId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    console.error('[drift-api] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
