import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { validateKeyFormat, validateKeyWithProvider } from '@/lib/credentials/validation';
import { AiProvider, CredentialType } from '@prisma/client';

const validateSchema = z.object({
  provider: z.nativeEnum(AiProvider),
  credentialType: z.nativeEnum(CredentialType),
  apiKey: z.string().min(1, 'API key is required'),
});

/**
 * POST /api/credentials/validate
 * Validate an API key by format and by calling the provider API.
 * Does NOT store the key.
 */
export async function POST(request: NextRequest) {
  try {
    await getCurrentUserOrToken(request);
    const body = await request.json();
    const validated = validateSchema.parse(body);

    // Format validation
    const formatCheck = validateKeyFormat(
      validated.provider,
      validated.credentialType,
      validated.apiKey
    );
    if (!formatCheck.valid) {
      return NextResponse.json({ valid: false, error: formatCheck.error });
    }

    // Provider validation
    const providerCheck = await validateKeyWithProvider(
      validated.provider,
      validated.credentialType,
      validated.apiKey
    );

    return NextResponse.json({
      valid: providerCheck.valid,
      error: providerCheck.error || null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json({ valid: false, error: firstIssue?.message || 'Validation failed' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }
    console.error('Failed to validate credential:', error);
    return NextResponse.json({ error: 'Failed to validate credential' }, { status: 500 });
  }
}
