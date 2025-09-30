'use client';

import { Plus } from 'lucide-react';
import type { Stage } from '@prisma/client';

interface NewTicketButtonProps {
  stage: Stage;
}

/**
 * NewTicketButton Component (Client Component)
 * Displays a button to create new tickets in a specific stage
 */
export function NewTicketButton({ stage }: NewTicketButtonProps) {
  const handleClick = () => {
    // TODO: Implement create ticket modal/form
    console.log('Create new ticket in', stage);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-lg border border-dashed border-white/15 bg-white/5 px-5 py-4 text-sm text-zinc-100/90 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white flex items-center justify-center gap-2 font-medium"
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm">New Ticket</span>
    </button>
  );
}
