/**
 * GET /api/projects/[projectId]/tickets/[id]/comparisons/[filename]
 *
 * Retrieves a specific comparison report by filename.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId, ticket id, and filename params
 *
 * @returns JSON response with comparison report content
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { Octokit } from '@octokit/rest';
import { parseReportFilename } from '@/lib/comparison/comparison-generator';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; filename: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString, filename } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    // Validate ticketId
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate filename format
    const parsedFilename = parseReportFilename(filename);
    if (!parsedFilename) {
      return NextResponse.json(
        {
          error: 'Invalid filename format',
          code: 'VALIDATION_ERROR',
          message: 'Expected format: YYYYMMDD-HHMMSS-vs-KEYS.md',
        },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Query ticket
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId: projectId },
      include: { project: true },
    });

    if (!ticket) {
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (ticketExists) {
        return NextResponse.json(
          { error: 'Forbidden', code: 'WRONG_PROJECT' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if ticket has branch
    if (!ticket.branch) {
      return NextResponse.json(
        {
          error: 'Comparison not available',
          code: 'COMPARISON_NOT_AVAILABLE',
          message: 'Ticket does not have a branch assigned',
        },
        { status: 404 }
      );
    }

    // Check for test mode
    const isTestEnvironment = process.env.TEST_MODE === 'true';
    if (isTestEnvironment) {
      // Return mock content for testing
      return NextResponse.json({
        filename,
        content: `# Test Comparison Report\n\nThis is mock comparison content for testing.\n\n## Summary\n\nMock data only.`,
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceTicket: ticket.ticketKey,
          comparedTickets: parsedFilename.comparedTickets,
          alignmentScore: 75,
          branch: ticket.branch,
        },
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: githubToken });
    const branch = ticket.stage === 'SHIP' ? 'main' : ticket.branch;

    try {
      // Fetch comparison file content
      const response = await octokit.repos.getContent({
        owner: ticket.project.githubOwner,
        repo: ticket.project.githubRepo,
        path: `specs/${ticket.branch}/comparisons/${filename}`,
        ref: branch,
      });

      if (!('content' in response.data) || !response.data.content) {
        return NextResponse.json(
          {
            error: 'Comparison report not found',
            code: 'REPORT_NOT_FOUND',
          },
          { status: 404 }
        );
      }

      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

      // Parse timestamp from filename
      // Supports both YYYYMMDD-HHMMSS and YYYYMMDD (date-only) formats
      const { timestamp, comparedTickets } = parsedFilename;
      const year = timestamp.slice(0, 4);
      const month = timestamp.slice(4, 6);
      const day = timestamp.slice(6, 8);

      let generatedAt: Date;
      if (timestamp.length > 8) {
        // Full format: YYYYMMDD-HHMMSS
        const hour = timestamp.slice(9, 11);
        const minute = timestamp.slice(11, 13);
        const second = timestamp.slice(13, 15);
        generatedAt = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
      } else {
        // Date-only format: YYYYMMDD
        generatedAt = new Date(`${year}-${month}-${day}T00:00:00Z`);
      }

      // Try to extract best implementation score from content
      let alignmentScore = 0;

      // New format: "### 🏆 Best: **AIB-125** (92%)"
      const bestMatch = content.match(/🏆.*?\((?:score:\s*)?(\d+)%\)/i);
      if (bestMatch && bestMatch[1]) {
        alignmentScore = parseInt(bestMatch[1], 10);
      } else {
        // Ranking table format: "| 1 | AIB-125 | 92% |"
        const rankingMatch = content.match(/\|\s*1\s*\|[^|]+\|\s*(\d+)%/);
        if (rankingMatch && rankingMatch[1]) {
          alignmentScore = parseInt(rankingMatch[1], 10);
        } else {
          // Legacy format
          const legacyMatch = content.match(/\*\*Feature Alignment\*\*:\s*(\d+)%/);
          if (legacyMatch && legacyMatch[1]) {
            alignmentScore = parseInt(legacyMatch[1], 10);
          }
        }
      }

      return NextResponse.json({
        filename,
        content,
        metadata: {
          generatedAt: generatedAt.toISOString(),
          sourceTicket: ticket.ticketKey,
          comparedTickets,
          alignmentScore,
          branch: ticket.branch,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Not Found') ||
          error.message.includes('404'))
      ) {
        return NextResponse.json(
          {
            error: 'Comparison report not found',
            code: 'REPORT_NOT_FOUND',
          },
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching comparison report:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
