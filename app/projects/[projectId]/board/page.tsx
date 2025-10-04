import { notFound } from 'next/navigation';
import { Board } from '@/components/board/board';
import { getTicketsByStage } from '@/lib/db/tickets';
import { getProjectById } from '@/lib/db/projects';

// Force dynamic rendering to ensure fresh data on router.refresh()
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Project-Scoped Board Page (Server Component)
 * Main kanban board view for a specific project
 * - Validates project exists
 * - Fetches tickets for the project
 * - Renders Board component with grouped tickets and projectId
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

  return (
    <main className="h-screen bg-black overflow-hidden">
      <Board ticketsByStage={ticketsByStage} projectId={projectId} />
    </main>
  );
}
