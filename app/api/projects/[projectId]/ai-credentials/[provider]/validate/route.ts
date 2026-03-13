import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { aiProviderSchema } from '@/lib/schemas/ai-credentials';
import { revalidateProjectAiCredential } from '@/lib/services/ai-credential-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; provider: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    const provider = aiProviderSchema.parse(params.provider);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);
    const providerStatus = await revalidateProjectAiCredential(projectId, provider);

    if (!providerStatus) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json(providerStatus);
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
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    console.error('[POST /api/projects/:projectId/ai-credentials/:provider/validate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
