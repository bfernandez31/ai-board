import { Column } from './column';
import { getAllStagesInOrder } from '@/lib/utils/stage';
import type { BoardProps } from '@/lib/types';

/**
 * Board Component (Server Component)
 * Displays the kanban board with all 6 workflow columns
 * - Responsive grid layout
 * - Horizontal scroll on mobile
 */
export function Board({ ticketsByStage }: BoardProps) {
  const stages = getAllStagesInOrder();

  return (
    <div className="w-full h-full">
      {/* Board Grid */}
      <div
        className="grid gap-6 overflow-x-auto pb-4"
        style={{
          gridTemplateColumns: 'repeat(6, minmax(280px, 1fr))',
          height: 'calc(100vh - 200px)',
        }}
      >
        {stages.map((stage) => (
          <Column key={stage} stage={stage} tickets={ticketsByStage[stage]} />
        ))}
      </div>
    </div>
  );
}