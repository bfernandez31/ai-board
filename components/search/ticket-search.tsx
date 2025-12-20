'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TicketSearchResult } from './ticket-search-result';
import { searchTickets, type TicketSearchProps } from '@/lib/utils/ticket-search';
import { cn } from '@/lib/utils';

export function TicketSearch({
  tickets,
  onSelectTicket,
  className,
  placeholder = 'Search tickets...',
}: TicketSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchTickets(tickets, query), [tickets, query]);

  const handleSelect = useCallback(
    (ticketId: number) => {
      onSelectTicket(ticketId);
      setQuery('');
      setIsOpen(false);
    },
    [onSelectTicket]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          setQuery('');
          setIsOpen(false);
          break;
      }
    },
    [results, selectedIndex, handleSelect]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Open dropdown when typing
  useEffect(() => {
    setIsOpen(query.trim().length > 0);
  }, [query]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        '[data-selected="true"]'
      );
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      role="combobox"
      aria-expanded={isOpen}
      aria-owns="ticket-search-listbox"
      data-testid="ticket-search"
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-controls="ticket-search-listbox"
          aria-label="Search tickets"
          data-testid="ticket-search-input"
          className="pl-9 w-64"
        />
      </div>

      {isOpen && (
        <div
          id="ticket-search-listbox"
          ref={resultsRef}
          role="listbox"
          aria-label="Search results"
          data-testid="ticket-search-results"
          className="absolute mt-1 w-64 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto z-50"
        >
          {results.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="ticket-search-empty"
              className="p-3 text-sm text-muted-foreground text-center"
            >
              No results found
            </div>
          ) : (
            results.map((result, index) => (
              <TicketSearchResult
                key={result.id}
                ticket={result}
                isSelected={index === selectedIndex}
                onClick={() => handleSelect(result.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
