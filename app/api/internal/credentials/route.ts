import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Agent } from '@prisma/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import {
  buildWorkflowPayload,
  getCredentialProviderForAgent,
  getMissingCredentialError,
  getOwnerCredential,
  updateOwnerCredential,
} from '@/lib/ai-credentials/workflow';

const putSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  provider: z.enum(['ANTHROPIC', 'OPENAI']),
  value: z.string().min(1),
  encoding: z.enum(['base64', 'plain']).default('base64'),
});

const querySchema = z.object({
  projectId: z.coerce.number().int().positive(),
  provider: z.enum(['ANTHROPIC', 'OPENAI']).optional(),
  agent: z.nativeEnum(Agent).optional(),
}).superRefine((value, ctx) => {
  if (value.provider && value.agent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['agent'],
      message: 'Provide either provider or agent, not both',
    });
  }
});

export async function GET(request: NextRequest) {
  const authResult = validateWorkflowAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    projectId: request.nextUrl.searchParams.get('projectId'),
    provider: request.nextUrl.searchParams.get('provider') ?? undefined,
    agent: request.nextUrl.searchParams.get('agent') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { projectId, provider: providerInput, agent } = parsed.data;
  const provider = providerInput ?? (agent ? getCredentialProviderForAgent(agent) : 'ANTHROPIC');

  try {
    const credential = await getOwnerCredential(projectId, provider);

    if (!credential) {
      return NextResponse.json(
        { error: getMissingCredentialError(provider) },
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

export async function PUT(request: NextRequest) {
  const authResult = validateWorkflowAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = putSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { projectId, provider, value, encoding } = parsed.data;
  const plaintext = encoding === 'base64' ? Buffer.from(value, 'base64').toString('utf8') : value;

  try {
    const updated = await updateOwnerCredential(projectId, provider, plaintext);

    if (!updated) {
      return NextResponse.json(
        { error: 'No existing credential found to update' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Failed to update workflow credential:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update credential' },
      { status: 500 }
    );
  }
}
