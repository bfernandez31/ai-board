import { Board } from '@/components/board/board';
import { getTicketsByStage } from '@/lib/db/tickets';
import { getProject } from '@/lib/db/projects';
import { notFound } from 'next/navigation';

// Force dynamic rendering to ensure fresh data on router.refresh()
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Board Page (Server Component)
 * Main kanban board view - full screen immersive experience
 * - Fetches tickets from database
 * - Renders Board component with grouped tickets
 */
export default async function BoardPage() {
  // This route is deprecated - redirect handled by root page
  // Keeping for backwards compatibility during migration
  const projectId = 1; // Default project
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

  const ticketsByStage = await getTicketsByStage(projectId);

  return (
    <main className="h-screen bg-black overflow-hidden">
      <Board
        ticketsByStage={ticketsByStage}
        projectId={projectId}
      />
    </main>
  );
}
