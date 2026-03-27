import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getComparisonDetailForProject } from '@/lib/comparison/comparison-detail';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  comparisonId: z.coerce.number().int().positive(),
});

type RouteParams = { projectId: string; comparisonId: string };

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

async function parseRouteParams(
  context: { params: Promise<RouteParams> }
): Promise<{ projectId: number; comparisonId: number } | null> {
  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return null;
  }

  return {
    projectId: paramsResult.data.projectId,
    comparisonId: paramsResult.data.comparisonId,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await parseRouteParams(context);
    if (!params) {
      return jsonError(400, 'Invalid project or comparison ID', 'VALIDATION_ERROR');
    }

    const { projectId, comparisonId } = params;
    await verifyProjectAccess(projectId, request);

    const detail = await getComparisonDetailForProject(projectId, comparisonId);
    if (!detail) {
      return jsonError(404, 'Comparison not found', 'COMPARISON_NOT_FOUND');
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return jsonError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}
