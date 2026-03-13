import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { aiProviderSchema, upsertProjectAiCredentialSchema } from '@/lib/schemas/ai-credentials';
import { deleteProjectAiCredential, upsertProjectAiCredential } from '@/lib/services/ai-credential-service';

export async function PUT(
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
    const userId = await requireAuth(request);
    const body = upsertProjectAiCredentialSchema.parse(await request.json());

    const providerStatus = await upsertProjectAiCredential(
      projectId,
      provider,
      body.apiKey,
      userId
    );

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

    console.error('[PUT /api/projects/:projectId/ai-credentials/:provider] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const deleted = await deleteProjectAiCredential(projectId, provider);

    if (!deleted) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({ provider, status: 'NOT_CONFIGURED' });
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

    console.error('[DELETE /api/projects/:projectId/ai-credentials/:provider] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
