import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { ProjectIdSchema } from '@/lib/validations/ticket';

/**
 * GET /api/projects/[projectId]/tickets/verify
 * Returns all tickets in VERIFY stage for a project.
 *
 * Authentication: Session-based (NextAuth.js) OR Workflow API token (Bearer)
 * Used by: Comparisons hub page (session), .github/workflows/auto-ship.yml (workflow token)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Try session auth first, fall back to workflow auth
    const workflowAuth = validateWorkflowAuth(request);
    if (!workflowAuth.isValid) {
      try {
        await verifyProjectAccess(projectId);
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch all tickets in VERIFY stage for this project
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId,
        stage: 'VERIFY',
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        branch: true,
        stage: true,
        updatedAt: true,
      },
      orderBy: { ticketKey: 'asc' },
    });

    return NextResponse.json(
      { tickets },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching VERIFY tickets:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
