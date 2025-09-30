import { Column } from './column';
import { getAllStagesInOrder } from '@/lib/utils/stage';
import type { BoardProps } from '@/lib/types';

/**
 * Board Component (Server Component)
 * Displays the kanban board with all 6 workflow columns
 * - Responsive grid layout with tighter spacing
 * - Horizontal scroll on mobile
 * - Dark background
 */
export function Board({ ticketsByStage }: BoardProps) {
  const stages = getAllStagesInOrder();

  return (
    <div className="w-full h-full bg-black">
      {/* Board Grid */}
      <div
        className="grid gap-4 overflow-x-auto pb-6 px-4 pt-4"
        style={{
          gridTemplateColumns: 'repeat(6, minmax(300px, 1fr))',
          height: 'calc(100vh - 32px)',
        }}
      >
        {stages.map((stage) => (
          <Column key={stage} stage={stage} tickets={ticketsByStage[stage]} />
        ))}
      </div>
    </div>
  );
}