import { notFound } from 'next/navigation';
import { Board } from '@/components/board/board';
import { getTicketsByStage } from '@/lib/db/tickets';
import { getProject } from '@/lib/db/projects';
import { getAllJobsForTickets } from '@/lib/job-queries';

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

  // Check if project exists and belongs to current user
  try {
    await getProject(projectId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'Project not found' || error.message === 'Unauthorized')
    ) {
      notFound();
    }
    throw error;
  }

  // Fetch tickets for this project
  const ticketsByStage = await getTicketsByStage(projectId);

  // Get all ticket IDs for job fetching
  const allTickets = Object.values(ticketsByStage).flat();
  const ticketIds = allTickets.map((ticket) => ticket.id);

  // Fetch initial jobs for all tickets (single batch query)
  // For dual job display, we need ALL jobs per ticket, not just one
  const initialJobs = await getAllJobsForTickets(ticketIds);

  return (
    <main className="h-[calc(100vh-4rem)] bg-black overflow-hidden">
      <Board
        ticketsByStage={ticketsByStage}
        projectId={projectId}
        initialJobs={initialJobs}
      />
    </main>
  );
}
