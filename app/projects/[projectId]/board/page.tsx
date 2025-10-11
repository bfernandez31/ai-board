import { notFound } from 'next/navigation';
import { Board } from '@/components/board/board';
import { getTicketsByStage } from '@/lib/db/tickets';
import { getProjectById } from '@/lib/db/projects';
import { getJobsForTickets } from '@/lib/job-queries';

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
  // Await params (Next.js 15 requirement)
  const { projectId: projectIdString } = await params;

  // Parse and validate projectId
  const projectId = parseInt(projectIdString, 10);

  // Return 404 if projectId is not a valid number
  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  // Check if project exists
  const project = await getProjectById(projectId);
  if (!project) {
    notFound();
  }

  // Fetch tickets for this project
  const ticketsByStage = await getTicketsByStage(projectId);

  // Get all ticket IDs for job fetching
  const allTickets = Object.values(ticketsByStage).flat();
  const ticketIds = allTickets.map((ticket) => ticket.id);

  // Fetch initial jobs for all tickets (single batch query)
  const initialJobs = await getJobsForTickets(ticketIds);

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
