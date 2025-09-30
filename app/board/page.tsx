import { Board } from '@/components/board/board';
import { getTicketsByStage } from '@/lib/db/tickets';

/**
 * Board Page (Server Component)
 * Main kanban board view - full screen immersive experience
 * - Fetches tickets from database
 * - Renders Board component with grouped tickets
 */
export default async function BoardPage() {
  const ticketsByStage = await getTicketsByStage();

  return (
    <main className="h-screen bg-black overflow-hidden">
      <Board ticketsByStage={ticketsByStage} />
    </main>
  );
}