'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCommandPalette } from '@/lib/hooks/queries/use-command-palette';
import { CommandPaletteResults } from '@/components/search/command-palette-results';
import type { CommandPaletteResult } from '@/lib/types';

interface CommandPaletteProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function CommandPalette({
  projectId,
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data, isLoading, error } = useCommandPalette(
    projectId,
    debouncedQuery,
    open
  );

  const groups = data?.groups ?? { destinations: [], tickets: [] };
  const results = useMemo(
    () => [...groups.destinations, ...groups.tickets],
    [groups.destinations, groups.tickets]
  );

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      return;
    }

    const frameId = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (isEditableElement(event.target)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    function handleOpenRequest() {
      onOpenChange(true);
    }

    document.addEventListener('keydown', handleShortcut);
    window.addEventListener('project-command-palette:open', handleOpenRequest);

    return () => {
      document.removeEventListener('keydown', handleShortcut);
      window.removeEventListener('project-command-palette:open', handleOpenRequest);
    };
  }, [onOpenChange]);

  const handleSelect = useCallback(
    (result: CommandPaletteResult) => {
      router.push(result.href);
      onOpenChange(false);
    },
    [onOpenChange, router]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (results.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selectedResult = results[selectedIndex];
        if (selectedResult) {
          handleSelect(selectedResult);
        }
      }
    },
    [handleSelect, onOpenChange, results, selectedIndex]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Project command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search project destinations and tickets.
        </DialogDescription>

        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search destinations and tickets..."
              aria-label="Search destinations and tickets"
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          <CommandPaletteResults
            groups={groups}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            isLoading={isLoading}
            error={error as Error | null}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
