'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Stage } from '@prisma/client';
import { NewTicketModal } from './new-ticket-modal';

interface NewTicketButtonProps {
  stage: Stage;
}

/**
 * NewTicketButton Component (Client Component)
 * Displays a button to create new tickets in a specific stage
 * Integrates with NewTicketModal for ticket creation workflow
 * Note: stage parameter reserved for future multi-stage support
 */
export function NewTicketButton({ stage: _ }: NewTicketButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const router = useRouter();

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
        className="w-full rounded-lg border border-dashed border-white/15 bg-white/5 px-5 py-4 text-sm text-zinc-100/90 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">New Ticket</span>
      </button>

      <NewTicketModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onTicketCreated={handleTicketCreated}
      />
    </>
  );
}
