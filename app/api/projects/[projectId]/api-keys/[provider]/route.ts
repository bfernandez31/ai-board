import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { deleteApiKey } from '@/lib/db/api-keys';
import type { ApiKeyProvider } from '@prisma/client';

const VALID_PROVIDERS = new Set<string>(['ANTHROPIC', 'OPENAI']);

type RouteContext = { params: Promise<{ projectId: string; provider: string }> };

/**
 * DELETE /api/projects/[projectId]/api-keys/[provider]
 * Remove an API key for a specific provider — owner only.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    const provider = params.provider.toUpperCase();

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const deleted = await deleteApiKey(projectId, provider as ApiKeyProvider);

    if (!deleted) {
      return NextResponse.json(
        { error: `No API key found for provider ${provider}` },
        { status: 404 }
      );
    }

    const providerLabel = provider === 'ANTHROPIC' ? 'Anthropic' : 'OpenAI';

    return NextResponse.json({
      provider,
      configured: false,
      message: `API key removed. Workflows requiring ${providerLabel} will be blocked until a new key is configured.`,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Only project owners can manage API keys' },
          { status: 403 }
        );
      }
    }
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
