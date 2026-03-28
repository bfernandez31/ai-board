'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Stage } from '@prisma/client';
import { NewTicketModal } from './new-ticket-modal';

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
        className="w-full rounded-xl border border-dashed border-ctp-mauve/20 bg-transparent px-5 py-4 text-sm text-muted-foreground transition-all hover:border-ctp-mauve/35 hover:text-primary flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">New Ticket</span>
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
