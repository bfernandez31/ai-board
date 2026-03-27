import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { listProjectComparisonCandidates } from '@/lib/comparison/project-comparison-candidates';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

type RouteParams = { projectId: string };

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

async function parseProjectParams(
  context: { params: Promise<RouteParams> }
): Promise<{ projectId: number } | null> {
  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return null;
  }

  return { projectId: paramsResult.data.projectId };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await parseProjectParams(context);
    if (!params) {
      return jsonError(400, 'Invalid project ID', 'VALIDATION_ERROR');
    }

    await verifyProjectAccess(params.projectId, request);
    const candidates = await listProjectComparisonCandidates(params.projectId);

    return NextResponse.json({ candidates });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return jsonError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}
