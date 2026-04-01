import { NextRequest, NextResponse } from 'next/server';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { getOwnerCredential, buildWorkflowPayload } from '@/lib/ai-credentials/workflow';

export async function GET(request: NextRequest) {
  const authResult = validateWorkflowAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectIdParam = request.nextUrl.searchParams.get('projectId');
  if (!projectIdParam) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const projectId = parseInt(projectIdParam, 10);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: 'projectId must be a number' }, { status: 400 });
  }

  try {
    const credential = await getOwnerCredential(projectId);

    if (!credential) {
      return NextResponse.json(
        {
          error:
            'No AI credential configured for project owner. Please add your Anthropic key in Settings.',
        },
        { status: 404 }
      );
    }

    const payload = buildWorkflowPayload(credential);

    return NextResponse.json({
      envVar: payload.envVar,
      value: payload.secret,
      credentialType: payload.credentialType,
    });
  } catch (error) {
    console.error('Failed to resolve workflow credential:', error);
    return NextResponse.json(
      { error: 'Failed to resolve credential' },
      { status: 500 }
    );
  }
}
