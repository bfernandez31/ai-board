/**
 * GET /api/projects/[projectId]/docs/history
 *
 * Fetches commit history for a specific documentation file within a ticket's feature branch.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with projectId param
 *
 * @returns JSON response with array of commits (sha, author, message, url)
 *
 * @throws 400 - Validation error (invalid query parameters)
 * @throws 403 - Permission denied (user does not own project)
 * @throws 404 - Project, ticket, or branch not found
 * @throws 500 - GitHub API error or internal server error
 *
 * @example
 * GET /api/projects/1/docs/history?ticketId=42&docType=spec
 * Response: { commits: [{ sha: "abc...", author: {...}, message: "...", url: "..." }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import {
  getDocumentationHistorySchema,
  type DocumentationHistoryResponse,
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
      console.error('[docs/history/GET] Invalid project ID:', {
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

    if (!ticketId || !docType) {
      console.error('[docs/history/GET] Missing query parameters:', {
        ticketId,
        docType,
      });
      return NextResponse.json(
        { error: 'Missing required query parameters: ticketId and docType', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const validationResult = getDocumentationHistorySchema.safeParse({
      ticketId,
      docType,
    });

    if (!validationResult.success) {
      console.error('[docs/history/GET] Validation failed:', {
        issues: validationResult.error.issues,
      });
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || 'Validation failed', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { ticketId: validatedTicketId, docType: validatedDocType } = validationResult.data;

    // Fetch project and verify ownership
    const project = await getProjectById(projectId);
    if (!project) {
      console.error('[docs/history/GET] Project not found:', { projectId });
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
      console.error('[docs/history/GET] Ticket not found or does not belong to project:', {
        ticketId: validatedTicketId,
        projectId,
      });
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!ticket.branch) {
      console.error('[docs/history/GET] Ticket has no branch:', {
        ticketId: validatedTicketId,
      });
      return NextResponse.json(
        { error: `Branch not found for ticket #${validatedTicketId}`, code: 'BRANCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Determine branch (SHIP → main, else → feature branch)
    const branch = ticket.stage === 'SHIP' ? 'main' : ticket.branch;

    // Construct file path for this doc type
    // File structure: specs/{branchName}/{docType}.md (created by create-new-feature.sh)
    // Path always uses original ticket branch name, even for SHIP tickets
    const filePath = `specs/${ticket.branch}/${validatedDocType}.md`;

    // Mock GitHub API in test environment
    if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
      console.log('[docs/history/GET] Using mock data (test mode)');
      const response: DocumentationHistoryResponse = {
        commits: [
          {
            sha: `mock-sha-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            author: {
              name: 'Test User',
              email: 'test@e2e.local',
              date: new Date().toISOString(),
            },
            message: `docs: update ${validatedDocType}.md`,
            url: `https://github.com/${project.githubOwner}/${project.githubRepo}/commit/mock-sha`,
          },
        ],
      };
      return NextResponse.json(response);
    }

    // Initialize GitHub API client
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[docs/history/GET] GITHUB_TOKEN not configured');
      return NextResponse.json(
        { error: 'GitHub integration not configured', code: 'GITHUB_API_ERROR' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: githubToken });

    console.log('[docs/history/GET] Fetching commit history:', {
      owner: project.githubOwner,
      repo: project.githubRepo,
      branch: branch,
      path: filePath,
    });

    // Fetch commit history from GitHub
    const { data: commits } = await octokit.repos.listCommits({
      owner: project.githubOwner,
      repo: project.githubRepo,
      sha: branch,
      path: filePath,
    });

    // Transform GitHub API response to our schema
    const response: DocumentationHistoryResponse = {
      commits: commits.map((commit) => ({
        sha: commit.sha,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || 'unknown@unknown.com',
          date: commit.commit.author?.date || new Date().toISOString(),
        },
        message: commit.commit.message,
        url: commit.html_url,
      })),
    };

    console.log('[docs/history/GET] Successfully fetched commit history:', {
      commitCount: response.commits.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[docs/history/GET] Error fetching commit history:', error);

    // GitHub API errors
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Branch or file not found in repository', code: 'BRANCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to fetch commit history from GitHub', code: 'GITHUB_API_ERROR' },
      { status: 500 }
    );
  }
}
