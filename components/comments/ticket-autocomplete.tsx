/**
 * TicketAutocomplete Component
 *
 * Dropdown list of project tickets for # autocomplete.
 * Supports mouse and keyboard navigation.
 * Follows UserAutocomplete component pattern.
 */

'use client';

import { cn } from '@/lib/utils';
import type { SearchResult } from '@/app/lib/types/search';

interface TicketAutocompleteProps {
  tickets: SearchResult[];
  onSelect: (ticket: SearchResult) => void;
  selectedIndex: number;
}

export function TicketAutocomplete({
  tickets,
  onSelect,
  selectedIndex,
}: TicketAutocompleteProps) {
  if (tickets.length === 0) {
    return (
      <div
        data-testid="ticket-autocomplete"
        className="bg-popover border border-border rounded-md shadow-md p-2 max-h-[280px] overflow-y-auto"
        role="listbox"
        aria-label="Ticket autocomplete"
      >
        <div className="text-sm text-muted-foreground p-2 text-center">
          No tickets found
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="ticket-autocomplete"
      className="bg-popover border border-border rounded-md shadow-md max-h-[280px] overflow-y-auto"
      role="listbox"
      aria-label="Ticket autocomplete"
    >
      {tickets.map((ticket, index) => (
        <button
          key={ticket.id}
          type="button"
          data-testid="ticket-autocomplete-item"
          data-selected={index === selectedIndex}
          className={cn(
            'w-full text-left px-3 py-2 transition-colors focus:outline-none cursor-pointer',
            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            index === selectedIndex && 'bg-primary text-primary-foreground'
          )}
          onClick={() => onSelect(ticket)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="font-mono font-medium text-sm">
                {ticket.ticketKey}
              </span>
              <span
                className={cn(
                  'ml-2 text-sm truncate',
                  index === selectedIndex
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground'
                )}
              >
                {ticket.title}
              </span>
            </div>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                index === selectedIndex
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {ticket.stage}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
