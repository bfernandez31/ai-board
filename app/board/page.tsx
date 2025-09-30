import { Board } from '@/components/board/board';
import { getTicketsByStage } from '@/lib/db/tickets';

/**
 * Board Page (Server Component)
 * Main kanban board view
 * - Fetches tickets from database
 * - Renders Board component with grouped tickets
 */
export default async function BoardPage() {
  const ticketsByStage = await getTicketsByStage();

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <p className="text-muted-foreground mt-2">
          Track your tickets across workflow stages
        </p>
      </header>

      <Board ticketsByStage={ticketsByStage} />
    </main>
  );
}