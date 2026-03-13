import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { verifyProjectOwnership, verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { saveApiKey, listApiKeys } from '@/lib/db/api-keys';
import { saveApiKeySchema, validateKeyFormat, validateKeyWithProvider } from '@/lib/api-keys/validate';
import { prisma } from '@/lib/db/client';
import type { APIProvider as PrismaAPIProvider } from '@prisma/client';

type RouteContext = { params: Promise<{ projectId: string }> };

function parseProjectId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

/**
 * GET /api/projects/[projectId]/api-keys
 *
 * List configured API keys for a project (masked).
 * Owner sees preview + updatedAt; member sees only configured status.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId: raw } = await context.params;
    const projectId = parseProjectId(raw);
    if (!projectId) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Verify access (owner or member)
    await verifyProjectAccess(projectId, request);

    // Check if current user is the owner
    const userId = await requireAuth(request);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });
    const isOwner = project?.userId === userId;

    const keys = await listApiKeys(projectId, isOwner);
    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
      }
    }
    console.error('Error listing API keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/api-keys
 *
 * Save or replace an API key for a provider.
 * Owner-only. Validates format, optionally validates with provider API.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { projectId: raw } = await context.params;
    const projectId = parseProjectId(raw);
    if (!projectId) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const body = await request.json();
    const validated = saveApiKeySchema.parse(body);
    const trimmedKey = validated.apiKey.trim();

    // Format validation
    const formatError = validateKeyFormat(validated.provider, trimmedKey);
    if (formatError) {
      return NextResponse.json(
        { error: formatError, code: 'INVALID_FORMAT' },
        { status: 400 }
      );
    }

    // Live validation (unless skipped)
    let wasValidated = false;
    if (!validated.skipValidation) {
      const validationResult = await validateKeyWithProvider(validated.provider, trimmedKey);

      if (!validationResult.valid && !validationResult.unreachable) {
        return NextResponse.json(
          { error: 'API key validation failed: key is invalid or expired', code: 'VALIDATION_FAILED' },
          { status: 400 }
        );
      }

      // If unreachable, save with warning (FR-014)
      if (validationResult.unreachable) {
        const { preview } = await saveApiKey(
          projectId,
          validated.provider as PrismaAPIProvider,
          trimmedKey
        );
        return NextResponse.json({
          provider: validated.provider,
          configured: true,
          preview,
          validated: false,
          message: 'API key saved without validation (provider unreachable)',
        });
      }

      wasValidated = true;
    }

    // Save the key
    const { preview } = await saveApiKey(
      projectId,
      validated.provider as PrismaAPIProvider,
      trimmedKey
    );

    return NextResponse.json({
      provider: validated.provider,
      configured: true,
      preview,
      validated: wasValidated,
      message: 'API key saved successfully',
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
        return NextResponse.json({ error: 'Not the project owner' }, { status: 403 });
      }
    }
    console.error('Error saving API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
