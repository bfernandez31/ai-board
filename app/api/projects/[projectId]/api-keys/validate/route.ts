import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { validateApiKeySchema, validateKeyFormat, validateKeyWithProvider } from '@/lib/api-keys/validate';

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * POST /api/projects/[projectId]/api-keys/validate
 *
 * Test an API key without saving it. Owner-only.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId: raw } = await context.params;
    const projectId = parseInt(raw, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const body = await request.json();
    const validated = validateApiKeySchema.parse(body);
    const trimmedKey = validated.apiKey.trim();

    // Format validation first
    const formatError = validateKeyFormat(validated.provider, trimmedKey);
    if (formatError) {
      return NextResponse.json(
        { error: formatError, code: 'INVALID_FORMAT' },
        { status: 400 }
      );
    }

    // Live validation against provider API
    const result = await validateKeyWithProvider(validated.provider, trimmedKey);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Not the project owner' }, { status: 403 });
      }
    }
    console.error('Error validating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
