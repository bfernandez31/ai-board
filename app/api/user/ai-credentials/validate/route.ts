import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import {
  AiCredentialTypeSchema,
  AiProviderSchema,
  validateProviderCredential,
} from '@/lib/ai/credentials';

const ValidateAiCredentialSchema = z.object({
  provider: AiProviderSchema,
  credentialType: AiCredentialTypeSchema,
  secret: z.string().min(1).max(500),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await getCurrentUserOrToken(request);
    const body = await request.json();
    const parsed = ValidateAiCredentialSchema.safeParse(body);

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
        { valid: false, error: validation.error ?? 'Credential validation failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to validate AI credential:', error);
    return NextResponse.json({ error: 'Failed to validate AI credential' }, { status: 500 });
  }
}
