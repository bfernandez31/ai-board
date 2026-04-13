import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { prisma } from '@/lib/db/client';

const querySchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

/**
 * Returns the project owner's GitHub OAuth access token.
 * Used by workflows to clone/push to repos owned by the project owner.
 * Protected by workflow API token auth.
 */
export async function GET(request: NextRequest) {
  const authResult = validateWorkflowAuth(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    projectId: request.nextUrl.searchParams.get('projectId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { projectId } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const account = await prisma.account.findFirst({
      where: { userId: project.userId, provider: 'github' },
      select: { access_token: true, scope: true },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No GitHub access token found for project owner' },
        { status: 404 }
      );
    }

    // Check that the token has repo scope
    const scopes = account.scope?.split(/[,\s]+/) ?? [];
    if (!scopes.includes('repo')) {
      return NextResponse.json(
        { error: 'Owner GitHub token lacks repo scope' },
        { status: 403 }
      );
    }

    // Base64-encode to avoid accidental plaintext leaks in logs
    const encodedToken = Buffer.from(account.access_token).toString('base64');
    const hasWorkflowScope = scopes.includes('workflow');

    return NextResponse.json(
      { token: encodedToken, encoding: 'base64', hasWorkflowScope },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Failed to resolve GitHub token:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to resolve GitHub token' },
      { status: 500 }
    );
  }
}
