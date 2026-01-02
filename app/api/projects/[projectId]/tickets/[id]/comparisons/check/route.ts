/**
 * GET /api/projects/[projectId]/tickets/[id]/comparisons/check
 *
 * Quick check if a ticket has any comparison reports.
 * Used to conditionally show the "Compare" button in UI.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON response with hasComparisons boolean, count, and latest report
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { Octokit } from '@octokit/rest';
import type { ComparisonCheckResult } from '@/lib/types/comparison';
import { parseReportFilename } from '@/lib/comparison/comparison-generator';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

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

    // No branch = no comparisons possible
    if (!ticket.branch) {
      const result: ComparisonCheckResult = {
        hasComparisons: false,
        count: 0,
        latestReport: null,
      };
      return NextResponse.json(result);
    }

    // Check for test mode
    const isTestEnvironment = process.env.TEST_MODE === 'true';
    if (isTestEnvironment) {
      const result: ComparisonCheckResult = {
        hasComparisons: false,
        count: 0,
        latestReport: null,
      };
      return NextResponse.json(result);
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
        const result: ComparisonCheckResult = {
          hasComparisons: false,
          count: 0,
          latestReport: null,
        };
        return NextResponse.json(result);
      }

      // Filter comparison files
      const comparisonFiles = response.data
        .filter((file) => file.type === 'file' && file.name.endsWith('.md'))
        .map((file) => ({
          name: file.name,
          parsed: parseReportFilename(file.name),
        }))
        .filter((f) => f.parsed !== null)
        .sort((a, b) => {
          // Sort by timestamp descending (newest first)
          const timestampA = a.parsed?.timestamp || '';
          const timestampB = b.parsed?.timestamp || '';
          return timestampB.localeCompare(timestampA);
        });

      const result: ComparisonCheckResult = {
        hasComparisons: comparisonFiles.length > 0,
        count: comparisonFiles.length,
        latestReport: comparisonFiles[0]?.name || null,
      };

      return NextResponse.json(result);
    } catch (error) {
      // Directory doesn't exist - no comparisons
      if (
        error instanceof Error &&
        (error.message.includes('Not Found') ||
          error.message.includes('404'))
      ) {
        const result: ComparisonCheckResult = {
          hasComparisons: false,
          count: 0,
          latestReport: null,
        };
        return NextResponse.json(result);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error checking comparisons:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
