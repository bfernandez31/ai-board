'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Stage } from '@prisma/client';
import { NewTicketModal } from './new-ticket-modal';
import { useUsage } from '@/hooks/use-usage';

interface NewTicketButtonProps {
  stage: Stage;
  projectId: number;
}

/**
 * NewTicketButton Component (Client Component)
 * Displays a button to create new tickets in a specific stage
 * Integrates with NewTicketModal for ticket creation workflow
 * Note: stage parameter reserved for future multi-stage support
 */
export function NewTicketButton({ stage: _, projectId }: NewTicketButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const router = useRouter();
  const { data: usage } = useUsage();

  const ticketLimit = usage?.ticketsThisMonth.limit;
  const ticketCurrent = usage?.ticketsThisMonth.current ?? 0;
  const isAtLimit = ticketLimit != null && ticketCurrent >= ticketLimit;

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const handleTicketCreated = () => {
    // Refresh the board to show the new ticket
    router.refresh();
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full rounded-lg border border-dashed border-[#45475a] bg-[#313244]/30 px-5 py-4 text-sm text-[#cdd6f4] transition-all hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6] flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">New Ticket</span>
        {ticketLimit != null && (
          <span className={`text-xs ${isAtLimit ? 'text-red-400' : 'text-zinc-500'}`}>
            ({ticketCurrent}/{ticketLimit})
          </span>
        )}
      </button>

      <NewTicketModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onTicketCreated={handleTicketCreated}
        projectId={projectId}
      />
    </>
  );
}
