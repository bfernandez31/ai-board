'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { SearchResults } from './search-results';
import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';
import type { SearchResult } from '@/app/lib/types/search';

interface TicketSearchProps {
  projectId: number;
}

export function TicketSearch({ projectId }: TicketSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounce search term (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch search results
  const { data, isLoading, error } = useTicketSearch(projectId, debouncedTerm);
  const results = useMemo(() => data?.results ?? [], [data?.results]);

  // Open dropdown when we have a query
  useEffect(() => {
    setIsOpen(debouncedTerm.length >= 2);
    setSelectedIndex(0);
  }, [debouncedTerm]);

  // Handle result selection - opens ticket modal via URL params
  const handleSelect = useCallback(
    (result: SearchResult) => {
      const params = new URLSearchParams(searchParams);
      params.set('ticket', result.ticketKey);
      params.set('modal', 'open');
      router.push(`?${params.toString()}`);

      // Clear search and close dropdown
      setSearchTerm('');
      setIsOpen(false);
    },
    [router, searchParams]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle Escape when dropdown is closed but input has text
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
        } else if (searchTerm) {
          setSearchTerm('');
        }
        return;
      }

      // Navigation only works when dropdown is open with results
      if (!isOpen || results.length === 0) {
        return;
      }

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
            handleSelect(results[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, results, selectedIndex, searchTerm, handleSelect]
  );

  // Auto-scroll selected item into view
  useEffect(() => {
    const selected = document.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-64 pl-9"
            aria-label="Search tickets"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-80 p-0 max-h-[300px] overflow-y-auto"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SearchResults
          results={results}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          isLoading={isLoading}
          error={error}
        />
      </PopoverContent>
    </Popover>
  );
}
