import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { verifyProjectAccess, verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getApiKeysByProject, saveApiKey } from '@/lib/db/api-keys';
import { encrypt } from '@/lib/crypto/encryption';
import { validateApiKeyFormat } from '@/lib/validation/api-key-formats';
import type { ApiKeyProvider } from '@prisma/client';

const apiKeySaveSchema = z.object({
  provider: z.enum(['ANTHROPIC', 'OPENAI']),
  key: z.string().min(20).max(500),
});

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/[projectId]/api-keys
 * List configured API keys (masked) — owner or member.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);
    const keys = await getApiKeysByProject(projectId);

    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    console.error('Error listing API keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/api-keys
 * Save or replace an API key — owner only.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const body = await request.json();
    const { provider, key } = apiKeySaveSchema.parse(body);

    // Format validation before encryption
    const formatResult = validateApiKeyFormat(provider as ApiKeyProvider, key);
    if (!formatResult.valid) {
      return NextResponse.json({ error: formatResult.error }, { status: 400 });
    }

    const preview = key.slice(-4);
    const encryptedKey = encrypt(key);
    const saved = await saveApiKey(projectId, provider as ApiKeyProvider, encryptedKey, preview);

    return NextResponse.json({
      provider: saved.provider,
      preview: saved.preview,
      configured: true,
      updatedAt: saved.updatedAt.toISOString(),
    });
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
        return NextResponse.json(
          { error: 'Only project owners can manage API keys' },
          { status: 403 }
        );
      }
    }
    console.error('Error saving API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
