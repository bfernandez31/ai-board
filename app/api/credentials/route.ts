import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { upsertApiCredential, listApiCredentials } from '@/lib/db/api-credentials';
import { validateKeyFormat } from '@/lib/credentials/validation';
import { AiProvider, CredentialType } from '@prisma/client';

const upsertSchema = z.object({
  provider: z.nativeEnum(AiProvider),
  credentialType: z.nativeEnum(CredentialType),
  label: z.string().min(1, 'Label is required').max(100, 'Label must be 100 characters or less'),
  apiKey: z.string().min(1, 'API key is required'),
});

/**
 * GET /api/credentials
 * List all API credentials (metadata only) for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);
    const credentials = await listApiCredentials(user.id);

    return NextResponse.json({
      credentials: credentials.map((c) => ({
        id: c.id,
        provider: c.provider,
        credentialType: c.credentialType,
        label: c.label,
        preview: c.preview,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }
    console.error('Failed to list credentials:', error);
    return NextResponse.json({ error: 'Failed to list credentials' }, { status: 500 });
  }
}

/**
 * POST /api/credentials
 * Create or replace an API credential (one per provider per user).
 * The API key is encrypted before storage and never returned.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);
    const body = await request.json();
    const validated = upsertSchema.parse(body);

    // Format validation
    const formatCheck = validateKeyFormat(
      validated.provider,
      validated.credentialType,
      validated.apiKey
    );
    if (!formatCheck.valid) {
      return NextResponse.json({ error: formatCheck.error }, { status: 400 });
    }

    const credential = await upsertApiCredential(
      user.id,
      validated.provider,
      validated.credentialType,
      validated.label,
      validated.apiKey
    );

    return NextResponse.json(
      {
        id: credential.id,
        provider: credential.provider,
        credentialType: credential.credentialType,
        label: credential.label,
        preview: credential.preview,
        createdAt: credential.createdAt.toISOString(),
        updatedAt: credential.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json({ error: firstIssue?.message || 'Validation failed' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }
    console.error('Failed to save credential:', error);
    return NextResponse.json({ error: 'Failed to save credential' }, { status: 500 });
  }
}
