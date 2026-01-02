/**
 * GET /api/projects/[projectId]/tickets/[id]/comparisons
 *
 * Lists comparison reports for a ticket.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON response with comparison list
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 403 - Ticket belongs to different project
 * @throws 404 - Project or ticket not found
 * @throws 500 - GitHub API error or internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { Octokit } from '@octokit/rest';
import type { ComparisonSummary } from '@/lib/types/comparison';
import { parseReportFilename } from '@/lib/comparison/comparison-generator';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10;

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
      return NextResponse.json({
        comparisons: [],
        total: 0,
        limit,
        offset: 0,
      });
    }

    // Check for test mode
    const isTestEnvironment = process.env.TEST_MODE === 'true';
    if (isTestEnvironment) {
      // Return mock data for testing
      return NextResponse.json({
        comparisons: [],
        total: 0,
        limit,
        offset: 0,
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
      // List files in comparisons directory
      const response = await octokit.repos.getContent({
        owner: ticket.project.githubOwner,
        repo: ticket.project.githubRepo,
        path: `specs/${ticket.branch}/comparisons`,
        ref: branch,
      });

      if (!Array.isArray(response.data)) {
        return NextResponse.json({
          comparisons: [],
          total: 0,
          limit,
          offset: 0,
        });
      }

      // Filter and parse comparison files
      const comparisonFiles = response.data
        .filter((file) => file.type === 'file' && file.name.endsWith('.md'))
        .map((file) => {
          const parsed = parseReportFilename(file.name);
          if (!parsed) return null;

          // Parse timestamp from filename (YYYYMMDD-HHMMSS)
          const year = parsed.timestamp.slice(0, 4);
          const month = parsed.timestamp.slice(4, 6);
          const day = parsed.timestamp.slice(6, 8);
          const hour = parsed.timestamp.slice(9, 11);
          const minute = parsed.timestamp.slice(11, 13);
          const second = parsed.timestamp.slice(13, 15);
          const generatedAt = new Date(
            `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
          );

          return {
            filename: file.name,
            generatedAt: generatedAt.toISOString(),
            sourceTicket: ticket.ticketKey,
            comparedTickets: parsed.comparedTickets,
            alignmentScore: 0, // Would need to read file content for actual score
            isAligned: true,
          } as ComparisonSummary;
        })
        .filter((c): c is ComparisonSummary => c !== null)
        .sort(
          (a, b) =>
            new Date(b.generatedAt).getTime() -
            new Date(a.generatedAt).getTime()
        )
        .slice(0, limit);

      return NextResponse.json({
        comparisons: comparisonFiles,
        total: comparisonFiles.length,
        limit,
        offset: 0,
      });
    } catch (error) {
      // Directory doesn't exist - no comparisons
      if (
        error instanceof Error &&
        (error.message.includes('Not Found') ||
          error.message.includes('404'))
      ) {
        return NextResponse.json({
          comparisons: [],
          total: 0,
          limit,
          offset: 0,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error listing comparisons:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
