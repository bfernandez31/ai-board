import { NextRequest, NextResponse } from 'next/server';
import { Agent } from '@prisma/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { getWorkflowAgentCredential } from '@/lib/db/project-api-keys';

function parseProjectId(projectId: string): number | null {
  const parsed = parseInt(projectId, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function parseAgent(value: string | null): Agent | null {
  if (value === Agent.CLAUDE || value === Agent.CODEX) {
    return value;
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const auth = validateWorkflowAuth(request);
    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdString } = await context.params;
    const projectId = parseProjectId(projectIdString);
    const agent = parseAgent(request.nextUrl.searchParams.get('agent'));

    if (!projectId) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Invalid agent' }, { status: 400 });
    }

    const credential = await getWorkflowAgentCredential(projectId, agent);
    if (!credential) {
      return NextResponse.json({ error: 'Project API key not configured' }, { status: 404 });
    }

    return NextResponse.json({
      provider: credential.provider,
      apiKey: credential.apiKey,
    });
  } catch (error) {
    console.error('[agent-credentials] Failed to resolve workflow credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
