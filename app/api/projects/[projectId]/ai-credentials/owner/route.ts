import { NextRequest, NextResponse } from 'next/server';
import { getProjectOwnerAiCredential } from '@/lib/db/ai-credentials';
import { AI_CREDENTIAL_ENV_VAR_MAP } from '@/lib/ai/credentials';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const isWorkflowAuth = await verifyWorkflowToken(request);
    if (!isWorkflowAuth) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid workflow token' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const credential = await getProjectOwnerAiCredential(projectId);

    if (!credential) {
      return NextResponse.json(
        { error: 'Project owner has no Anthropic credential configured' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      provider: credential.provider,
      credentialType: credential.credentialType,
      envVarName: AI_CREDENTIAL_ENV_VAR_MAP[credential.credentialType],
      secret: credential.secret,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.error('Failed to fetch project owner AI credential:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project owner AI credential' },
      { status: 500 }
    );
  }
}
