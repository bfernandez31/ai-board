import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  deleteProjectApiKey,
  getProjectApiKeysState,
  setProjectApiKey,
} from '@/lib/db/project-api-keys';
import {
  projectApiKeyDeleteSchema,
  projectApiKeyUpdateSchema,
} from '@/app/lib/schemas/project-api-keys';

type ProjectApiKeysRouteContext = {
  params: Promise<{ projectId: string }>;
};

function parseProjectId(projectId: string): number | null {
  const parsed = parseInt(projectId, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

async function getProjectIdFromContext(
  context: ProjectApiKeysRouteContext
): Promise<number | null> {
  const { projectId } = await context.params;

  return parseProjectId(projectId);
}

function createInvalidProjectIdResponse(): NextResponse {
  return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
}

function handleProjectApiKeysError(error: unknown, action: string): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message === 'Project not found') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.error(`[project-api-keys] Failed to ${action}:`, error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  context: ProjectApiKeysRouteContext
): Promise<NextResponse> {
  try {
    const projectId = await getProjectIdFromContext(context);

    if (!projectId) {
      return createInvalidProjectIdResponse();
    }

    const apiKeys = await getProjectApiKeysState(projectId, request);
    return NextResponse.json({ apiKeys });
  } catch (error) {
    return handleProjectApiKeysError(error, 'fetch API key settings');
  }
}

export async function PATCH(
  request: NextRequest,
  context: ProjectApiKeysRouteContext
): Promise<NextResponse> {
  try {
    const projectId = await getProjectIdFromContext(context);

    if (!projectId) {
      return createInvalidProjectIdResponse();
    }

    const body = await request.json();
    const validated = projectApiKeyUpdateSchema.parse(body);

    const apiKeys = await setProjectApiKey(
      projectId,
      validated.provider,
      validated.apiKey,
      request
    );

    return NextResponse.json({ apiKeys });
  } catch (error) {
    return handleProjectApiKeysError(error, 'update API key');
  }
}

export async function DELETE(
  request: NextRequest,
  context: ProjectApiKeysRouteContext
): Promise<NextResponse> {
  try {
    const projectId = await getProjectIdFromContext(context);

    if (!projectId) {
      return createInvalidProjectIdResponse();
    }

    const body = await request.json();
    const validated = projectApiKeyDeleteSchema.parse(body);
    const apiKeys = await deleteProjectApiKey(projectId, validated.provider, request);

    return NextResponse.json({ apiKeys });
  } catch (error) {
    return handleProjectApiKeysError(error, 'delete API key');
  }
}
