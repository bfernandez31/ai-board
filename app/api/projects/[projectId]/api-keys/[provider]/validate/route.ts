import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getEncryptedKey } from '@/lib/db/api-keys';
import { decrypt } from '@/lib/crypto/encryption';
import type { ApiKeyProvider } from '@prisma/client';

const VALID_PROVIDERS = new Set<string>(['ANTHROPIC', 'OPENAI']);

type RouteContext = { params: Promise<{ projectId: string; provider: string }> };

async function validateAnthropicKey(apiKey: string): Promise<{ valid: boolean | null; message: string }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (response.status === 401) {
      return { valid: false, message: 'API key is invalid or has been revoked.' };
    }

    // 200 or 400 (invalid request) both mean the key authenticated
    return { valid: true, message: 'API key is valid and working.' };
  } catch {
    return { valid: null, message: 'Could not reach Anthropic API. Validation could not be completed.' };
  }
}

async function validateOpenAIKey(apiKey: string): Promise<{ valid: boolean | null; message: string }> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401) {
      return { valid: false, message: 'API key is invalid or has been revoked.' };
    }

    return { valid: true, message: 'API key is valid and working.' };
  } catch {
    return { valid: null, message: 'Could not reach OpenAI API. Validation could not be completed.' };
  }
}

/**
 * POST /api/projects/[projectId]/api-keys/[provider]/validate
 * Test a saved API key against the provider's API — owner only.
 */
export async function POST(
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

    const encryptedKey = await getEncryptedKey(projectId, provider as ApiKeyProvider);

    if (!encryptedKey) {
      return NextResponse.json(
        { error: `No API key configured for provider ${provider}` },
        { status: 404 }
      );
    }

    const apiKey = decrypt(encryptedKey);

    const result = provider === 'ANTHROPIC'
      ? await validateAnthropicKey(apiKey)
      : await validateOpenAIKey(apiKey);

    return NextResponse.json({
      provider,
      valid: result.valid,
      message: result.message,
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
    console.error('Error validating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
