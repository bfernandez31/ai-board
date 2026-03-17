'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  onNewTicket: () => void;
  onFocusSearch: () => void;
  onColumnNav: (columnIndex: number) => void;
  onToggleHelp: () => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  return target.isContentEditable;
}

export function useKeyboardShortcuts({
  enabled,
  onNewTicket,
  onFocusSearch,
  onColumnNav,
  onToggleHelp,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableElement(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key;

      switch (key) {
        case 'n':
        case 'N':
          event.preventDefault();
          onNewTicket();
          break;
        case 's':
        case 'S':
        case '/':
          event.preventDefault();
          onFocusSearch();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          event.preventDefault();
          onColumnNav(Number(key));
          break;
        case '?':
          event.preventDefault();
          onToggleHelp();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNewTicket, onFocusSearch, onColumnNav, onToggleHelp]);
}
