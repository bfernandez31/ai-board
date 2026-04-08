import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import {
  onboardingArtifactDocumentSchema,
  onboardingArtifactUpdateSchema,
} from '@/app/lib/schemas/project-setup';
import { getOnboardingArtifacts, updateOnboardingArtifacts } from '@/lib/onboarding/artifacts';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(_request);
    const { projectId: projectIdValue } = await params;
    const projectId = Number(projectIdValue);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const artifacts = await getOnboardingArtifacts(projectId, userId);
    return NextResponse.json({
      artifacts: artifacts.map((artifact) => onboardingArtifactDocumentSchema.parse(artifact)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.error('Failed to load onboarding artifacts:', error);
    return NextResponse.json({ error: 'Failed to load onboarding artifacts' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdValue } = await params;
    const projectId = Number(projectIdValue);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const payload = onboardingArtifactUpdateSchema.parse(body);
    const result = await updateOnboardingArtifacts(projectId, userId, payload.artifacts);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    console.error('Failed to update onboarding artifacts:', error);
    return NextResponse.json({ error: 'Failed to update onboarding artifacts' }, { status: 500 });
  }
}
