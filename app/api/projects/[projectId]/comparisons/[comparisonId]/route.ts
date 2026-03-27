import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getComparisonDetailForProject } from '@/lib/comparison/comparison-detail';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  comparisonId: z.coerce.number().int().positive(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; comparisonId: string }> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project or comparison ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { projectId, comparisonId } = paramsResult.data;
    await verifyProjectAccess(projectId, request);

    const detail = await getComparisonDetailForProject(projectId, comparisonId);
    if (!detail) {
      return NextResponse.json(
        { error: 'Comparison not found', code: 'COMPARISON_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
