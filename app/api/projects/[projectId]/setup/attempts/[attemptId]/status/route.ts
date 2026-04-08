import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { ProjectSetupStatus } from '@prisma/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import {
  ProjectSetupError,
  updateProjectSetupAttemptStatus,
} from '@/lib/project-setup/service';

const setupCallbackSchema = z.object({
  status: z.nativeEnum(ProjectSetupStatus),
  workflowRunId: z.number().int().positive().optional(),
  message: z.string().max(500).nullable().optional(),
  failureCode: z.string().max(100).nullable().optional(),
  failureMessage: z.string().max(2000).nullable().optional(),
  artifactSummary: z.unknown().nullable().optional(),
});

function parsePositiveInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; attemptId: string }> }
): Promise<NextResponse> {
  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdString, attemptId: attemptIdString } =
      await context.params;
    const projectId = parsePositiveInt(projectIdString);
    const attemptId = parsePositiveInt(attemptIdString);

    if (!projectId || !attemptId) {
      return NextResponse.json(
        { error: 'Invalid project or attempt ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsedPayload = setupCallbackSchema.parse(body);
    const payload = {
      status: parsedPayload.status,
      ...(parsedPayload.workflowRunId !== undefined
        ? { workflowRunId: parsedPayload.workflowRunId }
        : {}),
      ...(parsedPayload.message !== undefined
        ? { message: parsedPayload.message }
        : {}),
      ...(parsedPayload.failureCode !== undefined
        ? { failureCode: parsedPayload.failureCode }
        : {}),
      ...(parsedPayload.failureMessage !== undefined
        ? { failureMessage: parsedPayload.failureMessage }
        : {}),
      ...(parsedPayload.artifactSummary !== undefined
        ? { artifactSummary: parsedPayload.artifactSummary }
        : {}),
    };
    const response = await updateProjectSetupAttemptStatus(
      projectId,
      attemptId,
      payload
    );

    return NextResponse.json(response);
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

    console.error('Error updating project setup attempt status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
