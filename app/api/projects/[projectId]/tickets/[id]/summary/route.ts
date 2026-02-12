import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { fetchDocumentContent } from '@/lib/github/doc-fetcher';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId },
      include: {
        jobs: { where: { command: 'implement', status: 'COMPLETED' }, take: 1 },
        project: true,
      },
    });

    if (!ticket) {
      const ticketExists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (ticketExists) return NextResponse.json({ error: 'Forbidden', code: 'WRONG_PROJECT' }, { status: 403 });
      return NextResponse.json({ error: 'Ticket not found', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    }

    if (!ticket.branch) {
      return NextResponse.json({ error: 'Summary not available', code: 'SUMMARY_NOT_AVAILABLE', message: 'Ticket does not have a branch assigned' }, { status: 404 });
    }

    if (ticket.jobs.length === 0) {
      return NextResponse.json({ error: 'Summary not available', code: 'SUMMARY_NOT_AVAILABLE', message: 'Ticket does not have a completed "implement" job' }, { status: 404 });
    }

    const branch = ticket.stage === 'SHIP' ? 'main' : ticket.branch;

    try {
      const content = await fetchDocumentContent({
        owner: ticket.project.githubOwner,
        repo: ticket.project.githubRepo,
        branch,
        ticketBranch: ticket.branch,
        docType: 'summary',
      });

      return NextResponse.json({
        content,
        metadata: {
          ticketId: ticket.id, branch, projectId: ticket.projectId,
          docType: 'summary', fileName: 'summary.md',
          filePath: `specs/${ticket.branch}/summary.md`,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('GitHub API error fetching summary:', error instanceof Error ? error.message : error);
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) return NextResponse.json({ error: 'GitHub API rate limit exceeded', code: 'RATE_LIMIT' }, { status: 429 });
        if (error.message.includes('not found')) return NextResponse.json({ error: 'Summary file not found', code: 'FILE_NOT_FOUND', message: `File does not exist at specs/${ticket.branch}/summary.md` }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch summary', code: 'GITHUB_API_ERROR' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
