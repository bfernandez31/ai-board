import { NextRequest, NextResponse } from 'next/server';
import { AiCredentialProvider } from '@prisma/client';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import {
  getProjectOwnerCredentialEligibility,
  resolveProjectOwnerWorkflowCredential,
} from '@/lib/ai-credentials/workflow';
import { workflowCredentialRequestSchema } from '@/lib/validations/ai-credentials';

interface RouteContext {
  params: Promise<{ projectId: string; provider: string }>;
}

function parseProvider(provider: string): AiCredentialProvider | null {
  if (provider.toLowerCase() === 'anthropic') {
    return AiCredentialProvider.ANTHROPIC;
  }

  return null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const isAuthorized = await verifyWorkflowToken(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const projectId = Number(params.projectId);
    const provider = parseProvider(params.provider);

    if (!Number.isInteger(projectId) || projectId <= 0 || !provider) {
      return NextResponse.json(
        { error: 'Invalid workflow credential request', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsedBody = workflowCredentialRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid workflow credential request', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const eligibility = await getProjectOwnerCredentialEligibility(projectId, provider);
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: eligibility.message,
          code: eligibility.code,
          message: eligibility.message,
        },
        { status: eligibility.code === 'OWNER_CREDENTIAL_MISSING' ? 404 : 409 }
      );
    }

    const credential = await resolveProjectOwnerWorkflowCredential(projectId, provider);
    if (!credential) {
      return NextResponse.json(
        {
          error: 'Unable to verify project owner credential',
          code: 'CREDENTIAL_RETRIEVAL_FAILED',
          message: 'Retry later or ask the project owner to re-save the Anthropic credential.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(credential);
  } catch (error) {
    console.error('Failed to resolve owner workflow credential:', error);
    return NextResponse.json(
      { error: 'Credential retrieval failed', code: 'CREDENTIAL_RETRIEVAL_FAILED' },
      { status: 503 }
    );
  }
}
