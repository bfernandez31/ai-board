'use client';

import type { TicketSearchResultProps } from '@/lib/utils/ticket-search';
import { cn } from '@/lib/utils';

export function TicketSearchResult({
  ticket,
  isSelected,
  onClick,
}: TicketSearchResultProps) {
  return (
    <button
      role="option"
      aria-selected={isSelected}
      data-testid={`ticket-search-result-${ticket.ticketKey}`}
      data-selected={isSelected}
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
        'hover:bg-accent focus:bg-accent focus:outline-none',
        isSelected && 'bg-accent'
      )}
    >
      <span className="font-mono text-sm text-muted-foreground shrink-0">
        {ticket.ticketKey}
      </span>
      <span className="text-sm truncate">{ticket.title}</span>
    </button>
  );
}
