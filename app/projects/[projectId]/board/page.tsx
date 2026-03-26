import { notFound } from 'next/navigation';
import { Board } from '@/components/board/board';
import { ProjectShell } from '@/components/layout/project-shell';
import { getTicketsWithJobs } from '@/lib/db/tickets';
import { getProject } from '@/lib/db/projects';

// Force dynamic rendering to ensure fresh data on router.refresh()
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Project-Scoped Board Page (Server Component)
 * Main kanban board view for a specific project
 * - Validates project exists
 * - Fetches tickets for the project
 * - Fetches initial jobs for all tickets
 * - Renders Board component with grouped tickets, jobs, and projectId
 */
export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdString } = await params;

  // Parse and validate projectId
  const projectId = parseInt(projectIdString, 10);

  // Return 404 if projectId is not a valid number
  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  // Fetch project and tickets+jobs in parallel (validation + data)
  // Single optimized query for tickets with jobs included
  // T065: Include activeCleanupJobId in project data fetching
  const [project, { ticketsByStage, ticketsWithJobs }] = await Promise.all([
    getProject(projectId).catch((error) => {
      if (
        error instanceof Error &&
        (error.message === 'Project not found' || error.message === 'Unauthorized')
      ) {
        notFound();
      }
      throw error;
    }),
    getTicketsWithJobs(projectId),
  ]);

  // Transform tickets with jobs into initialJobs map
  // Jobs are already included in the tickets query (no N+1 problem)
  const allTicketsWithJobs = Object.values(ticketsWithJobs).flat();
  const initialJobs = new Map(
    allTicketsWithJobs.map((ticket) => [ticket.id, ticket.jobs])
  );

  return (
    <ProjectShell projectId={projectId}>
      <main className="h-[calc(100vh-4rem)] overflow-hidden bg-background">
        <Board
          ticketsByStage={ticketsByStage}
          projectId={projectId}
          initialJobs={initialJobs}
          activeCleanupJobId={project.activeCleanupJobId}
        />
      </main>
    </ProjectShell>
  );
}
