import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { getOwnerCredential } from '@/lib/ai-credentials/workflow';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import type { Agent } from '@prisma/client';

/**
 * GET /api/projects/[projectId]/setup/credential-check?agent=CLAUDE
 *
 * Check credential availability for a given agent.
 * Returns availability status and guidance if missing.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectOwnership(projectId, request);

    const agentParam = request.nextUrl.searchParams.get('agent');
    if (!agentParam || !['CLAUDE', 'CODEX'].includes(agentParam)) {
      return NextResponse.json(
        { error: 'Invalid or missing agent parameter. Use ?agent=CLAUDE or ?agent=CODEX' },
        { status: 400 }
      );
    }

    const agent = agentParam as Agent;
    const provider = AGENT_PROVIDER_MAP[agent];
    const credential = await getOwnerCredential(projectId, provider);

    if (credential?.readinessStatus === 'READY') {
      return NextResponse.json({
        available: true,
        provider,
        readinessStatus: 'READY',
      });
    }

    const providerName = provider === 'OPENAI' ? 'OpenAI' : 'Anthropic';
    const agentName = agent === 'CLAUDE' ? 'Claude Code' : 'Codex';

    return NextResponse.json({
      available: false,
      provider,
      guidance: `Add an ${providerName} API key or OAuth token in Settings → Credentials to use ${agentName}.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Only the project owner can check credentials', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    console.error('[credential-check] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
