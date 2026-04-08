import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import {
  projectSetupDispatchResponseSchema,
  projectSetupStartSchema,
  projectSetupStateSchema,
} from '@/app/lib/schemas/project-setup';
import { getProjectSetupState, startProjectSetup } from '@/lib/onboarding/service';

export async function GET(
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

    const state = await getProjectSetupState(projectId, userId);
    return NextResponse.json(projectSetupStateSchema.parse(state));
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 403 });
    }

    console.error('Failed to fetch project setup state:', error);
    return NextResponse.json({ error: 'Failed to fetch setup state' }, { status: 500 });
  }
}

export async function POST(
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
    const payload = projectSetupStartSchema.parse(body);
    const response = await startProjectSetup(projectId, userId, payload.selectedAgent);

    return NextResponse.json(projectSetupDispatchResponseSchema.parse(response), {
      status: response.duplicate ? 409 : 202,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 403 });
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'CredentialNotReady') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.name === 'SetupNotRequired') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Failed to start project setup:', error);
    return NextResponse.json({ error: 'Failed to start setup' }, { status: 500 });
  }
}
