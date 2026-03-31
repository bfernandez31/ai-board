import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { decryptApiKey } from '@/lib/db/api-credentials';
import { prisma } from '@/lib/db/client';
import { AiProvider } from '@prisma/client';

const fetchSchema = z.object({
  projectId: z.number().int().positive(),
  provider: z.nativeEnum(AiProvider),
});

/**
 * POST /api/workflows/credentials
 * Workflow-only endpoint to fetch the decrypted API key for a project owner.
 * Authenticated exclusively by workflow token (Bearer WORKFLOW_API_TOKEN).
 */
export async function POST(request: NextRequest) {
  // Strictly workflow-token auth only
  const isAuthorized = await verifyWorkflowToken(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = fetchSchema.parse(body);

    // Find the project owner
    const project = await prisma.project.findUnique({
      where: { id: validated.projectId },
      select: { userId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Decrypt the owner's credential
    const result = await decryptApiKey(project.userId, validated.provider);

    if (!result) {
      return NextResponse.json(
        {
          error: 'No API credential configured',
          message: 'The project owner has not configured an API key for this provider. Please ask them to add one in Settings > AI Credentials.',
        },
        { status: 404 }
      );
    }

    // Return the decrypted key and its type
    // The key is NEVER logged — only returned in the response body
    return NextResponse.json({
      credentialType: result.credentialType,
      apiKey: result.key,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json({ error: firstIssue?.message || 'Validation failed' }, { status: 400 });
    }
    console.error('Failed to fetch workflow credential');
    return NextResponse.json({ error: 'Failed to fetch credential' }, { status: 500 });
  }
}
