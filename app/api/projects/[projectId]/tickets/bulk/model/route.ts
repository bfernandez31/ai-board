import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { bulkModelSchema } from '@/lib/schemas/bulk-ticket';
import { bulkSetModel } from '@/lib/tickets/bulk';
import { CLAUDE_MODEL_IDS } from '@/lib/models/claude-models';

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
    const parsed = bulkModelSchema.safeParse(body);
    if (!parsed.success) {
      const isInvalidModel = parsed.error.issues.some(
        (issue) => issue.path.length === 1 && issue.path[0] === 'model',
      );
      const code = isInvalidModel ? 'INVALID_MODEL_ID' : 'VALIDATION_ERROR';
      const errorMessage = isInvalidModel
        ? `Unknown model ID. Allowed: ${CLAUDE_MODEL_IDS.join(', ')}`
        : 'Validation failed';
      return NextResponse.json(
        {
          error: errorMessage,
          code,
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await bulkSetModel({
      projectId,
      stage: parsed.data.stage,
      model: parsed.data.model,
      tickets: parsed.data.tickets,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Bulk model error:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to update ticket model overrides', code: 'DATABASE_ERROR' },
      { status: 500 },
    );
  }
}
