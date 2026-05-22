import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { TicketWithVersion } from '@/lib/types';

export interface UseTicketSelectionReturn {
  selectedIds: Set<number>;
  isSelectMode: boolean;
  selectedCount: number;
  toggleSelect: (id: number) => void;
  rangeSelect: (id: number, allIds: number[]) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;
}

export function useTicketSelection(inboxTickets: TicketWithVersion[]): UseTicketSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const lastClickedIdRef = useRef<number | null>(null);

  const inboxTicketIds = useMemo(() => new Set(inboxTickets.map((t) => t.id)), [inboxTickets]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<number>();
      for (const id of prev) {
        if (inboxTicketIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [inboxTicketIds]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedIdRef.current = id;
  }, []);

  const rangeSelect = useCallback((id: number, allIds: number[]) => {
    const lastId = lastClickedIdRef.current;
    if (lastId == null) {
      setSelectedIds((prev) => new Set(prev).add(id));
      lastClickedIdRef.current = id;
      return;
    }

    const startIdx = allIds.indexOf(lastId);
    const endIdx = allIds.indexOf(id);
    if (startIdx === -1 || endIdx === -1) {
      setSelectedIds((prev) => new Set(prev).add(id));
      lastClickedIdRef.current = id;
      return;
    }

    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (let i = lo; i <= hi; i++) {
        const ticketId = allIds[i];
        if (ticketId != null) next.add(ticketId);
      }
      return next;
    });
    lastClickedIdRef.current = id;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  }, []);

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);

  const isSelectMode = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    isSelectMode,
    selectedCount,
    toggleSelect,
    rangeSelect,
    clearSelection,
    isSelected,
  };
}
