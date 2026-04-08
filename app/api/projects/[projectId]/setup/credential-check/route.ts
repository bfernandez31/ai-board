import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';
import type { CredentialProvider } from '@prisma/client';

const querySchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
});

const AGENT_TO_PROVIDER: Record<string, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Auth: owner-only
    try {
      await verifyProjectOwnership(projectId, request);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (error instanceof Error && error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameter
    const agentParam = request.nextUrl.searchParams.get('agent');
    const parsed = querySchema.safeParse({ agent: agentParam });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid agent parameter' },
        { status: 400 }
      );
    }

    const { agent } = parsed.data;
    const provider = AGENT_TO_PROVIDER[agent];

    const credential = await getOwnerCredential(projectId, provider);
    const hasCredential = !!credential;

    return NextResponse.json({
      hasCredential,
      provider,
      ...(hasCredential ? {} : { settingsUrl: '/settings/credentials' }),
    });
  } catch (error) {
    console.error('[credential-check] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
