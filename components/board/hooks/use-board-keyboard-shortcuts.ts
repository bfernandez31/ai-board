import { useCallback, useEffect, useState } from 'react';
import { useHoverCapability } from '@/lib/hooks/use-hover-capability';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { STAGE_BY_NUMBER } from '../utils';

interface UseBoardKeyboardShortcutsArgs {
  isAnyModalOpen: boolean;
  isSelectMode?: boolean;
  onClearSelection?: () => void;
}

/**
 * AIB-299: Board-level keyboard shortcuts. Manages the help dialog open state
 * (persisted via localStorage), the new-ticket trigger state, and the listener
 * that lets `?` close the help dialog even while modals are open.
 */
export function useBoardKeyboardShortcuts({ isAnyModalOpen, isSelectMode, onClearSelection }: UseBoardKeyboardShortcutsArgs) {
  const hasHover = useHoverCapability();

  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('shortcuts-hint-dismissed') !== 'true'; } catch { return false; }
  });

  const handleShortcutsHelpChange = useCallback((open: boolean) => {
    setIsShortcutsHelpOpen(open);
    if (!open) {
      try { localStorage.setItem('shortcuts-hint-dismissed', 'true'); } catch {}
    }
  }, []);

  useKeyboardShortcuts({
    enabled: hasHover && !isAnyModalOpen,
    onNewTicket: useCallback(() => setIsNewTicketModalOpen(true), []),
    onFocusSearch: useCallback(() => window.dispatchEvent(new CustomEvent('open-command-palette')), []),
    onColumnNav: useCallback((columnIndex: number) => {
      const stage = STAGE_BY_NUMBER[columnIndex];
      if (stage) {
        document.querySelector<HTMLElement>(`[data-column="${stage}"]`)
          ?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      }
    }, []),
    onToggleHelp: useCallback(
      () => handleShortcutsHelpChange(!isShortcutsHelpOpen),
      [handleShortcutsHelpChange, isShortcutsHelpOpen]
    ),
  });

  useEffect(() => {
    if (!isSelectMode || !onClearSelection) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Don't hijack Escape when the user is typing in a form control
      // (e.g., the merge title/description fields) — they expect Escape
      // to blur the field or close the parent dialog.
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      onClearSelection!();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSelectMode, onClearSelection]);

  useEffect(() => {
    if (!isShortcutsHelpOpen) return;
    function handleHelpClose(event: KeyboardEvent) {
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        handleShortcutsHelpChange(false);
      }
    }
    document.addEventListener('keydown', handleHelpClose);
    return () => document.removeEventListener('keydown', handleHelpClose);
  }, [isShortcutsHelpOpen, handleShortcutsHelpChange]);

  return {
    isNewTicketModalOpen,
    setIsNewTicketModalOpen,
    isShortcutsHelpOpen,
    handleShortcutsHelpChange,
  };
}
