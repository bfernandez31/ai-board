import { NextRequest, NextResponse } from 'next/server';
import { Agent } from '@prisma/client';
import { ZodError } from 'zod';
import {
  getDecryptedProjectApiKey,
  getProjectApiKeysState,
} from '@/lib/db/project-api-keys';
import { validateProviderApiKey } from '@/lib/project-api-keys';
import { projectApiKeyTestSchema } from '@/app/lib/schemas/project-api-keys';

function parseProjectId(projectId: string): number | null {
  const parsed = parseInt(projectId, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdString } = await context.params;
    const projectId = parseProjectId(projectIdString);

    if (!projectId) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await getProjectApiKeysState(projectId, request);

    const body = await request.json();
    const validated = projectApiKeyTestSchema.parse(body);

    const candidateKey =
      validated.apiKey ??
      (await getDecryptedProjectApiKey(projectId, validated.provider));

    if (!candidateKey) {
      return NextResponse.json(
        {
          valid: false,
          message:
            validated.provider === 'openai'
              ? 'No OpenAI API key is configured for this project.'
              : 'No Anthropic API key is configured for this project.',
        },
        { status: 400 }
      );
    }

    const validation = await validateProviderApiKey(validated.provider, candidateKey);

    return NextResponse.json({
      ...validation,
      agent: validated.provider === 'openai' ? Agent.CODEX : Agent.CLAUDE,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[project-api-keys] Failed to validate API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
