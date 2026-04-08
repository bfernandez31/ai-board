import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { Agent } from '@prisma/client';
import { requireAuth } from '@/lib/db/users';
import { getProjectWithSetupAccess } from '@/lib/db/projects';
import {
  ProjectSetupError,
  startProjectSetupAttempt,
} from '@/lib/project-setup/service';

const startProjectSetupSchema = z.object({
  selectedAgent: z.nativeEnum(Agent),
});

function parseProjectId(value: string): number | null {
  const projectId = parseInt(value, 10);
  return Number.isNaN(projectId) || projectId <= 0 ? null : projectId;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdString } = await context.params;
    const projectId = parseProjectId(projectIdString);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const project = await getProjectWithSetupAccess(projectId, request);
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { selectedAgent } = startProjectSetupSchema.parse(body);
    const response = await startProjectSetupAttempt(projectId, selectedAgent);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }

    if (error instanceof ProjectSetupError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}) },
        { status: error.status }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.error('Error starting project setup attempt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
