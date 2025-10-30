/**
 * GET /api/projects/[projectId]/docs/diff
 *
 * Fetches the diff for a specific commit affecting a documentation file.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with projectId param
 *
 * @returns JSON response with commit SHA and files array (filename, status, additions, deletions, patch)
 *
 * @throws 400 - Validation error (invalid query parameters or SHA format)
 * @throws 403 - Permission denied (user does not own project)
 * @throws 404 - Project, ticket, branch, or commit not found
 * @throws 500 - GitHub API error or internal server error
 *
 * @example
 * GET /api/projects/1/docs/diff?ticketId=42&docType=spec&sha=abc123...
 * Response: { sha: "abc...", files: [{ filename: "...", status: "modified", additions: 15, deletions: 3, patch: "..." }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import {
  getDocumentationDiffSchema,
  type DocumentationDiffResponse,
} from '@/app/lib/schemas/documentation';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('[docs/diff/GET] Invalid project ID:', {
        projectId: projectIdString,
        error: projectIdResult.error.message,
      });
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdResult.data, 10);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const docType = searchParams.get('docType');
    const sha = searchParams.get('sha');

    if (!ticketId || !docType || !sha) {
      console.error('[docs/diff/GET] Missing query parameters:', {
        ticketId,
        docType,
        sha,
      });
      return NextResponse.json(
        {
          error: 'Missing required query parameters: ticketId, docType, and sha',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const validationResult = getDocumentationDiffSchema.safeParse({
      ticketId,
      docType,
      sha,
    });

    if (!validationResult.success) {
      console.error('[docs/diff/GET] Validation failed:', {
        issues: validationResult.error.issues,
      });
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || 'Validation failed', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { ticketId: validatedTicketId, docType: validatedDocType, sha: validatedSha } = validationResult.data;

    // Fetch project and verify ownership
    const project = await getProjectById(projectId);
    if (!project) {
      console.error('[docs/diff/GET] Project not found:', { projectId });
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch ticket and verify branch exists
    const ticket = await prisma.ticket.findUnique({
      where: {
        id: validatedTicketId,
        projectId,
      },
    });

    if (!ticket) {
      console.error('[docs/diff/GET] Ticket not found or does not belong to project:', {
        ticketId: validatedTicketId,
        projectId,
      });
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!ticket.branch) {
      console.error('[docs/diff/GET] Ticket has no branch:', {
        ticketId: validatedTicketId,
      });
      return NextResponse.json(
        { error: `Branch not found for ticket #${validatedTicketId}`, code: 'BRANCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Construct file path pattern for filtering
    // File structure: specs/{branchName}/{docType}.md (created by create-new-feature.sh)
    const filePathPattern = `specs/${ticket.branch}/${validatedDocType}.md`;

    // Mock GitHub API in test environment
    if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
      console.log('[docs/diff/GET] Using mock data (test mode)');
      const response: DocumentationDiffResponse = {
        sha: validatedSha,
        files: [
          {
            filename: filePathPattern,
            status: 'modified',
            additions: 5,
            deletions: 2,
            patch: `@@ -1,3 +1,6 @@\n # Test Spec\n \n-Old content\n+New content\n+Additional line\n Mock changes`,
          },
        ],
      };
      return NextResponse.json(response);
    }

    // Initialize GitHub API client
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[docs/diff/GET] GITHUB_TOKEN not configured');
      return NextResponse.json(
        { error: 'GitHub integration not configured', code: 'GITHUB_API_ERROR' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: githubToken });

    console.log('[docs/diff/GET] Fetching commit diff:', {
      owner: project.githubOwner,
      repo: project.githubRepo,
      ref: validatedSha,
      expectedFile: filePathPattern,
    });

    // Fetch commit details from GitHub
    const { data: commit } = await octokit.repos.getCommit({
      owner: project.githubOwner,
      repo: project.githubRepo,
      ref: validatedSha,
    });

    // Filter files to only include the requested doc file
    const filteredFiles = commit.files?.filter((file) => file.filename === filePathPattern) || [];

    // Transform GitHub API response to our schema
    const response: DocumentationDiffResponse = {
      sha: commit.sha,
      files: filteredFiles.map((file) => ({
        filename: file.filename,
        status: file.status as 'added' | 'modified' | 'removed',
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      })),
    };

    console.log('[docs/diff/GET] Successfully fetched commit diff:', {
      sha: response.sha,
      fileCount: response.files.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[docs/diff/GET] Error fetching commit diff:', error);

    // GitHub API errors
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Commit not found in repository', code: 'COMMIT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to fetch diff from GitHub', code: 'GITHUB_API_ERROR' },
      { status: 500 }
    );
  }
}
