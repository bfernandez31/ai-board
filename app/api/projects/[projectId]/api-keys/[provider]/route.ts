import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { deleteApiKey } from '@/lib/db/api-keys';
import type { APIProvider } from '@prisma/client';

type RouteContext = { params: Promise<{ projectId: string; provider: string }> };

const VALID_PROVIDERS = new Set(['ANTHROPIC', 'OPENAI']);

/**
 * DELETE /api/projects/[projectId]/api-keys/[provider]
 *
 * Delete an API key for a provider. Owner-only.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId: raw, provider } = await context.params;
    const projectId = parseInt(raw, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const deleted = await deleteApiKey(projectId, provider as APIProvider);

    if (!deleted) {
      return NextResponse.json(
        { error: 'API key not found for this provider' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'API key deleted successfully',
      provider,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Not the project owner' }, { status: 403 });
      }
    }
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
