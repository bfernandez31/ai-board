import { notFound, redirect } from 'next/navigation';
import { Board } from '@/components/board/board';
import { getTicketsWithJobs } from '@/lib/db/tickets';
import { getProject } from '@/lib/db/projects';
import { requireAuth } from '@/lib/db/users';

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

  // Fetch project, tickets+jobs, and current user in parallel
  const [project, { ticketsByStage, ticketsWithJobs }, userId] = await Promise.all([
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
    requireAuth(),
  ]);

  // Redirect to setup page if project is not yet configured
  if (!project.configSyncedAt) {
    redirect(`/projects/${projectId}/setup`);
  }

  // Transform tickets with jobs into initialJobs map
  // Jobs are already included in the tickets query (no N+1 problem)
  const allTicketsWithJobs = Object.values(ticketsWithJobs).flat();
  const initialJobs = new Map(
    allTicketsWithJobs.map((ticket) => [ticket.id, ticket.jobs])
  );

  return (
    <main className="h-[calc(100vh-4rem)] bg-black overflow-hidden">
      <Board
        ticketsByStage={ticketsByStage}
        projectId={projectId}
        initialJobs={initialJobs}
        specsGeneratedAt={project.specsGeneratedAt?.toISOString() ?? null}
        isOwner={project.userId === userId}
      />
    </main>
  );
}
