import { useCallback, useEffect, useState } from 'react';

export interface BulkSelectionApi {
  selectedIds: Set<number>;
  anchorId: number | null;
  isSelectMode: boolean;
  toggle: (id: number) => void;
  rangeSelectTo: (id: number, allInboxIdsSorted: number[]) => void;
  clear: () => void;
  cancel: () => void;
}

/**
 * Selection state for bulk operations on INBOX tickets (AIB-821).
 *
 * Lifecycle: pure React state, never persisted. Select mode auto-exits when
 * selectedIds returns to empty. `cancel()` is an explicit user action (Cancel
 * button or Escape key) and behaves the same as `clear()` from the caller's
 * perspective.
 */
export function useBulkSelection(allInboxIds: number[]): BulkSelectionApi {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [anchorId, setAnchorId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(allInboxIds);
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (valid.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setAnchorId((prev) => (prev != null && !allInboxIds.includes(prev) ? null : prev));
  }, [allInboxIds]);

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setAnchorId(id);
  }, []);

  const rangeSelectTo = useCallback(
    (id: number, allInboxIdsSorted: number[]) => {
      const startId = anchorId ?? id;
      const startIdx = allInboxIdsSorted.indexOf(startId);
      const endIdx = allInboxIdsSorted.indexOf(id);

      if (startIdx === -1 || endIdx === -1) {
        toggle(id);
        return;
      }

      const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const rangeIds = allInboxIdsSorted.slice(lo, hi + 1);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const rid of rangeIds) {
          next.add(rid);
        }
        return next;
      });
      setAnchorId(id);
    },
    [anchorId, toggle]
  );

  const clear = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
    setAnchorId(null);
  }, []);

  const cancel = clear;

  return {
    selectedIds,
    anchorId,
    isSelectMode: selectedIds.size > 0,
    toggle,
    rangeSelectTo,
    clear,
    cancel,
  };
}
