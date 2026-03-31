import { NextRequest, NextResponse } from 'next/server';
import { AiCredentialType, AiProvider } from '@prisma/client';
import { z } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { listUserAiCredentials, upsertUserAiCredential } from '@/lib/db/ai-credentials';
import {
  AiCredentialTypeSchema,
  AiProviderSchema,
  validateProviderCredential,
} from '@/lib/ai/credentials';

const CreateAiCredentialSchema = z.object({
  provider: AiProviderSchema,
  credentialType: AiCredentialTypeSchema,
  label: z.string().trim().min(1).max(100),
  secret: z.string().min(1).max(500),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUserOrToken(request);
    const credentials = await listUserAiCredentials(user.id);
    return NextResponse.json({ credentials });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to list AI credentials:', error);
    return NextResponse.json({ error: 'Failed to list AI credentials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUserOrToken(request);
    const body = await request.json();
    const parsed = CreateAiCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Validation failed',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const validation = await validateProviderCredential(
      parsed.data.provider,
      parsed.data.credentialType,
      parsed.data.secret
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? 'Credential validation failed' },
        { status: 400 }
      );
    }

    const credential = await upsertUserAiCredential({
      userId: user.id,
      provider: parsed.data.provider as AiProvider,
      credentialType: parsed.data.credentialType as AiCredentialType,
      label: parsed.data.label,
      secret: parsed.data.secret,
      lastValidatedAt: new Date(),
    });

    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to store AI credential:', error);
    return NextResponse.json({ error: 'Failed to store AI credential' }, { status: 500 });
  }
}
