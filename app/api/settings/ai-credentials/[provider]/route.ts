import { NextRequest, NextResponse } from 'next/server';
import { AiCredentialProvider, AiCredentialReadinessStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/db/users';
import { deleteUserAiCredential, saveUserAiCredential } from '@/lib/ai-credentials/service';
import { upsertAiCredentialSchema } from '@/lib/validations/ai-credentials';

interface RouteContext {
  params: Promise<{ provider: string }>;
}

function parseProvider(provider: string): AiCredentialProvider | null {
  if (provider.toLowerCase() === 'anthropic') {
    return AiCredentialProvider.ANTHROPIC;
  }

  return null;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    const params = await context.params;
    const provider = parseProvider(params.provider);

    if (!provider) {
      return NextResponse.json(
        { error: 'Unsupported provider', code: 'UNSUPPORTED_PROVIDER' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const payload = upsertAiCredentialSchema.parse({
      provider,
      ...body,
    });

    const credential = await saveUserAiCredential(user.id, payload);

    if (credential.readinessStatus !== AiCredentialReadinessStatus.READY) {
      const failureCode =
        credential.lastVerificationCode === 'INVALID_CREDENTIAL_FORMAT'
          ? 'VALIDATION_ERROR'
          : credential.lastVerificationCode || 'PROVIDER_VERIFICATION_FAILED';

      return NextResponse.json(
        {
          error: credential.lastVerificationMessage || 'Credential verification failed',
          code: failureCode,
          message: credential.lastVerificationMessage,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ credential });
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return NextResponse.json(
        {
          error: issue?.message || 'Validation failed',
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Validation failed',
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    console.error('Failed to save AI credential:', error);
    return NextResponse.json(
      { error: 'Failed to save AI credential' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    const params = await context.params;
    const provider = parseProvider(params.provider);

    if (!provider) {
      return NextResponse.json(
        { error: 'Unsupported provider', code: 'UNSUPPORTED_PROVIDER' },
        { status: 404 }
      );
    }

    const deleted = await deleteUserAiCredential(user.id, provider);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Credential not found', code: 'CREDENTIAL_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    console.error('Failed to delete AI credential:', error);
    return NextResponse.json(
      { error: 'Failed to delete AI credential' },
      { status: 500 }
    );
  }
}
