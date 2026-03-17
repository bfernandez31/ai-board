'use client';

import { useEffect, useCallback, useState } from 'react';
import { Stage } from '@/lib/stage-transitions';

/** Column index to stage mapping (1-6) */
const COLUMN_INDEX_TO_STAGE: Record<string, Stage> = {
  '1': Stage.INBOX,
  '2': Stage.SPECIFY,
  '3': Stage.PLAN,
  '4': Stage.BUILD,
  '5': Stage.VERIFY,
  '6': Stage.SHIP,
};

/** Check if device has a physical keyboard (not touch-only) */
function hasPhysicalKeyboard(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover)').matches;
}

/** Check if focus is on a text input element */
function isTextInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;

  if (active instanceof HTMLInputElement) {
    const textTypes = ['text', 'search', 'email', 'password', 'url', 'tel', 'number'];
    return textTypes.includes(active.type);
  }

  if (active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLElement && active.isContentEditable) return true;

  return false;
}

export interface BoardKeyboardShortcutsOptions {
  onNewTicket: () => void;
  onToggleHelp: () => void;
}

export interface BoardKeyboardShortcutsResult {
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
}

export function useBoardKeyboardShortcuts({
  onNewTicket,
  onToggleHelp,
}: BoardKeyboardShortcutsOptions): BoardKeyboardShortcutsResult {
  const [isHelpOpen, setIsHelpOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!hasPhysicalKeyboard()) return false;
    const dismissed = localStorage.getItem('shortcuts-hint-dismissed');
    if (!dismissed) {
      localStorage.setItem('shortcuts-hint-dismissed', 'true');
      return true;
    }
    return false;
  });

  const scrollToColumn = useCallback((stage: Stage) => {
    const column = document.querySelector(`[data-stage="${stage}"]`);
    if (column) {
      column.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  const focusSearch = useCallback(() => {
    document.dispatchEvent(new CustomEvent('board:focus-search'));
  }, []);

  useEffect(() => {
    if (!hasPhysicalKeyboard()) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in text fields
      if (isTextInputFocused()) return;

      // Don't intercept modified keys (Ctrl, Alt, Meta) except for standalone keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;

      // Escape: close help overlay (let modals handle their own Escape)
      if (key === 'Escape') {
        if (isHelpOpen) {
          e.preventDefault();
          setIsHelpOpen(false);
        }
        return;
      }

      // ? - Toggle help overlay (Shift+/ on most keyboards)
      if (key === '?') {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        onToggleHelp();
        return;
      }

      // Don't process other shortcuts if help overlay is open
      if (isHelpOpen) return;

      // N - Open new ticket modal
      if (key === 'n' || key === 'N') {
        e.preventDefault();
        onNewTicket();
        return;
      }

      // S or / - Focus search
      if (key === 's' || key === 'S' || key === '/') {
        e.preventDefault();
        focusSearch();
        return;
      }

      // 1-6 - Scroll to column
      const stage = COLUMN_INDEX_TO_STAGE[key];
      if (stage) {
        e.preventDefault();
        scrollToColumn(stage);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen, onNewTicket, onToggleHelp, scrollToColumn, focusSearch]);

  return { isHelpOpen, setIsHelpOpen };
}
