import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { createOrReplaceCredential, listCredentials } from '@/lib/ai-credentials/service';
import { validateFormat, verifyWithProvider } from '@/lib/ai-credentials/providers/anthropic';

const createCredentialSchema = z.object({
  provider: z.enum(['ANTHROPIC']),
  credentialType: z.enum(['API_KEY', 'OAUTH_TOKEN']),
  label: z.string().min(1, 'Label is required').max(100, 'Label must be 100 characters or less').transform(v => v.trim()),
  value: z.string().min(1, 'Credential value is required'),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);

    const credentials = await listCredentials(user.id);

    return NextResponse.json({
      credentials: credentials.map((c) => ({
        id: c.id,
        provider: c.provider,
        credentialType: c.credentialType,
        label: c.label,
        preview: c.preview,
        readinessStatus: c.readinessStatus,
        lastVerifiedAt: c.lastVerifiedAt?.toISOString() ?? null,
        verificationCode: c.verificationCode,
        verificationMessage: c.verificationMessage,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to list credentials:', error);
    return NextResponse.json({ error: 'Failed to list credentials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserOrToken(request);

    const body = await request.json();
    const validated = createCredentialSchema.parse(body);

    // Format validation
    const formatResult = validateFormat(validated.credentialType, validated.value);
    if (!formatResult.valid) {
      return NextResponse.json(
        { error: formatResult.error },
        { status: 400 }
      );
    }

    // Provider verification
    const verificationResult = await verifyWithProvider(validated.credentialType, validated.value);

    if (verificationResult.readinessStatus === 'ACTION_REQUIRED') {
      const code = verificationResult.verificationCode;
      if (code === 'UNREACHABLE') {
        return NextResponse.json(
          {
            error: 'Unable to validate credential: provider unreachable',
            code: 'PROVIDER_UNREACHABLE',
          },
          { status: 422 }
        );
      }
      return NextResponse.json(
        {
          error: `Credential validation failed: ${verificationResult.verificationMessage}`,
          code: verificationResult.verificationCode,
        },
        { status: 422 }
      );
    }

    // Check if existing credential exists for upsert status code
    const existing = await listCredentials(user.id);
    const hasExisting = existing.some(c => c.provider === validated.provider);

    const credential = await createOrReplaceCredential(user.id, validated, verificationResult);

    const responseData = {
      id: credential.id,
      provider: credential.provider,
      credentialType: credential.credentialType,
      label: credential.label,
      preview: credential.preview,
      readinessStatus: credential.readinessStatus,
      lastVerifiedAt: credential.lastVerifiedAt?.toISOString() ?? null,
      verificationCode: credential.verificationCode,
      verificationMessage: credential.verificationMessage,
      createdAt: credential.createdAt.toISOString(),
      updatedAt: credential.updatedAt.toISOString(),
    };

    return NextResponse.json(responseData, { status: hasExisting ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to create credential:', error);
    return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 });
  }
}
