'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { NAVIGATION_ITEMS } from './nav-items';
import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';
import { Loader2 } from 'lucide-react';

interface CommandPaletteProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ projectId, open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce ticket search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: ticketData, isLoading: ticketLoading } = useTicketSearch(projectId, debouncedSearch);

  // Reset search on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets transient input state when dialog opens, not cascading
      setSearch('');
      setDebouncedSearch('');
    }
  }, [open]);

  function hasOpenDialog(): boolean {
    return document.querySelector('[role="dialog"][data-state="open"]') !== null;
  }

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!hasOpenDialog()) onOpenChange(true);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  // Listen for custom event from board (S/slash shortcut)
  useEffect(() => {
    function handleCustomOpen() {
      if (!hasOpenDialog()) onOpenChange(true);
    }

    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => window.removeEventListener('open-command-palette', handleCustomOpen);
  }, [onOpenChange]);

  const handleSelect = useCallback(
    (href: string) => {
      // Skip redundant navigation
      if (pathname === href) {
        onOpenChange(false);
        return;
      }
      router.push(href);
      onOpenChange(false);
    },
    [router, pathname, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <CommandInput
            placeholder="Search tickets or navigate..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Navigation">
              {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon;
                const href = `/projects/${projectId}${item.href}`;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => handleSelect(href)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {(debouncedSearch.length >= 2 || ticketLoading) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tickets">
                  {ticketLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {ticketData?.results.map((ticket) => (
                    <CommandItem
                      key={ticket.id}
                      value={`${ticket.ticketKey} ${ticket.title}`}
                      onSelect={() =>
                        handleSelect(
                          `/projects/${projectId}/board?ticket=${ticket.ticketKey}&modal=open`
                        )
                      }
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {ticket.ticketKey}
                      </span>
                      {ticket.title}
                    </CommandItem>
                  ))}
                  {!ticketLoading && debouncedSearch.length >= 2 && ticketData?.results.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No tickets found.
                    </p>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
