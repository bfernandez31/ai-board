import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { getOwnerCredential, buildWorkflowPayload } from '@/lib/ai-credentials/workflow';

const querySchema = z.object({
  projectId: z.coerce.number().int().positive(),
  provider: z.enum(['ANTHROPIC', 'OPENAI']).optional().default('ANTHROPIC'),
});

export async function GET(request: NextRequest) {
  const authResult = validateWorkflowAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    projectId: request.nextUrl.searchParams.get('projectId'),
    provider: request.nextUrl.searchParams.get('provider') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'projectId is required and must be a positive integer' },
      { status: 400 }
    );
  }

  const { projectId, provider } = parsed.data;

  try {
    const credential = await getOwnerCredential(projectId, provider);

    if (!credential) {
      return NextResponse.json(
        {
          error:
            `No ${provider} credential configured for project owner. Please add your API key in Settings → AI Credentials.`,
        },
        { status: 404 }
      );
    }

    const payload = buildWorkflowPayload(credential);

    const encodedValue = Buffer.from(payload.secret).toString('base64');

    return NextResponse.json(
      {
        envVar: payload.envVar,
        value: encodedValue,
        encoding: 'base64',
        credentialType: payload.credentialType,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Failed to resolve workflow credential:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to resolve credential' },
      { status: 500 }
    );
  }
}
