/**
 * POST /api/projects/[projectId]/docs
 *
 * Commits and pushes edited documentation content to the ticket's feature branch.
 *
 * @param request - Next.js request object with JSON body
 * @param context - Route context with projectId param
 *
 * @returns JSON response with commit SHA and success status
 *
 * @throws 400 - Validation error (invalid request body or markdown syntax)
 * @throws 403 - Permission denied (wrong stage for docType)
 * @throws 404 - Project, ticket, or branch not found
 * @throws 409 - Merge conflict (concurrent edit detected)
 * @throws 500 - GitHub API error or internal server error
 * @throws 504 - Operation timeout
 *
 * @example
 * POST /api/projects/1/docs
 * Body: { ticketId: 42, docType: "spec", content: "# Updated Spec\n\nContent..." }
 * Response: { success: true, commitSha: "abc123...", updatedAt: "...", message: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { editDocumentationSchema } from '@/app/lib/schemas/documentation';
import { commitAndPush } from '@/app/lib/git/operations';
import { validateMarkdown } from '@/app/lib/git/validate';
import { canEdit, getPermissionErrorMessage } from '@/components/ticket/edit-permission-guard';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('[docs/POST] Invalid project ID:', {
        projectId: projectIdString,
        error: projectIdResult.error.message,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Parse and validate request body
    const body = await request.json();
    const parsed = editDocumentationSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[docs/POST] Request validation failed:', {
        projectId,
        body,
        issues: parsed.error.issues,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { ticketId, docType, content, commitMessage } = parsed.data;

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      console.error('[docs/POST] Project not found:', { projectId });
      return NextResponse.json(
        { success: false, error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get ticket with project-scoped validation
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId: projectId },
      include: { project: true },
    });

    if (!ticket) {
      // Check if ticket exists in different project
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (ticketExists) {
        console.error('[docs/POST] Ticket belongs to different project:', {
          ticketId,
          requestedProjectId: projectId,
        });
        return NextResponse.json(
          { success: false, error: 'Forbidden', code: 'WRONG_PROJECT' },
          { status: 403 }
        );
      }

      console.error('[docs/POST] Ticket not found:', { ticketId, projectId });
      return NextResponse.json(
        { success: false, error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if ticket has branch assigned
    if (!ticket.branch) {
      console.error('[docs/POST] Ticket has no branch:', {
        ticketId,
        projectId,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Branch not found for ticket',
          code: 'BRANCH_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Check stage-based permissions
    const canUserEdit = canEdit(ticket.stage, docType);
    if (!canUserEdit) {
      const errorMessage = getPermissionErrorMessage(ticket.stage, docType);
      console.error('[docs/POST] Permission denied:', {
        ticketId,
        stage: ticket.stage,
        docType,
      });
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: 'PERMISSION_DENIED',
        },
        { status: 403 }
      );
    }

    // Validate markdown syntax
    const validation = await validateMarkdown(content);
    if (!validation.valid) {
      console.error('[docs/POST] Invalid markdown:', {
        ticketId,
        docType,
        error: validation.error,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Invalid markdown: ${validation.error}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Construct file path
    // Extract feature directory from branch name
    // Branch format: "036-mode-to-update" → feature dir: "036-mode-to-update"
    const featureDir = ticket.branch;
    const filePath = `specs/${featureDir}/${docType}.md`;

    // Default commit message if not provided
    const message = commitMessage || `docs: update ${docType}.md for ticket #${ticketId}`;

    // Commit and push to GitHub
    try {
      const result = await commitAndPush({
        owner: project.githubOwner,
        repo: project.githubRepo,
        branch: ticket.branch,
        filePath,
        content,
        commitMessage: message,
        authorName: 'AI Board User', // TODO: Get from session when auth is implemented
        authorEmail: 'noreply@ai-board.local',
      });

      console.log('[docs/POST] Successfully committed and pushed:', {
        ticketId,
        docType,
        commitSha: result.commitSha,
        filePath,
      });

      return NextResponse.json({
        success: true,
        commitSha: result.commitSha,
        updatedAt: new Date().toISOString(),
        message: `${docType}.md updated successfully`,
      });
    } catch (error: any) {
      console.error('[docs/POST] Git operation failed:', {
        ticketId,
        docType,
        error: error.message,
      });

      // Handle merge conflicts
      if (error.message?.includes('another user has modified')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: 'MERGE_CONFLICT',
          },
          { status: 409 }
        );
      }

      // Handle branch not found
      if (error.message?.includes('Branch') && error.message?.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: 'BRANCH_NOT_FOUND',
          },
          { status: 404 }
        );
      }

      // Generic network/GitHub API error
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save changes to repository',
          code: 'NETWORK_ERROR',
          details: error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[docs/POST] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
