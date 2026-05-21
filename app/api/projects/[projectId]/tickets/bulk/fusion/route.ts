import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { fusionSchema } from '@/lib/schemas/bulk-ticket';
import { fuseTickets, FusionConflictError } from '@/lib/tickets/bulk';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  try {
    const { projectId: projectIdString } = await context.params;
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const projectId = parseInt(projectIdString, 10);

    await verifyProjectAccess(projectId, request);

    const body = await request.json();
    const parsed = fusionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await fuseTickets({ projectId, ...parsed.data });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FusionConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code, conflicting: error.conflicting },
        { status: 409 },
      );
    }
    console.error('Fusion error:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to fuse tickets', code: 'DATABASE_ERROR' },
      { status: 500 },
    );
  }
}
