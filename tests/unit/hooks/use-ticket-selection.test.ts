import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTicketSelection } from '@/components/board/hooks/use-ticket-selection';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(id: number): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `TEST-${id}`,
    title: `Ticket ${id}`,
    description: null,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    qualityScore: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as TicketWithVersion;
}

describe('useTicketSelection', () => {
  const tickets = [makeTicket(1), makeTicket(2), makeTicket(3), makeTicket(4), makeTicket(5)];

  it('should start with no selection', () => {
    const { result } = renderHook(() => useTicketSelection(tickets));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('should toggle a ticket selection', () => {
    const { result } = renderHook(() => useTicketSelection(tickets));

    act(() => result.current.toggleSelect(1));
    expect(result.current.isSelected(1)).toBe(true);
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelectMode).toBe(true);

    act(() => result.current.toggleSelect(1));
    expect(result.current.isSelected(1)).toBe(false);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isSelectMode).toBe(false);
  });

  it('should support range select with Shift', () => {
    const { result } = renderHook(() => useTicketSelection(tickets));
    const allIds = tickets.map((t) => t.id);

    act(() => result.current.toggleSelect(1));
    act(() => result.current.rangeSelect(4, allIds));

    expect(result.current.selectedCount).toBe(4);
    expect(result.current.isSelected(1)).toBe(true);
    expect(result.current.isSelected(2)).toBe(true);
    expect(result.current.isSelected(3)).toBe(true);
    expect(result.current.isSelected(4)).toBe(true);
    expect(result.current.isSelected(5)).toBe(false);
  });

  it('should clear all selections', () => {
    const { result } = renderHook(() => useTicketSelection(tickets));

    act(() => result.current.toggleSelect(1));
    act(() => result.current.toggleSelect(3));
    expect(result.current.selectedCount).toBe(2);

    act(() => result.current.clearSelection());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isSelectMode).toBe(false);
  });

  it('should auto-cleanup when tickets are removed', () => {
    const { result, rerender } = renderHook(
      ({ tickets: t }) => useTicketSelection(t),
      { initialProps: { tickets } }
    );

    act(() => result.current.toggleSelect(1));
    act(() => result.current.toggleSelect(3));
    expect(result.current.selectedCount).toBe(2);

    rerender({ tickets: [makeTicket(2), makeTicket(3), makeTicket(4)] });

    expect(result.current.isSelected(1)).toBe(false);
    expect(result.current.isSelected(3)).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });

  it('should handle range select when no previous click', () => {
    const { result } = renderHook(() => useTicketSelection(tickets));
    const allIds = tickets.map((t) => t.id);

    act(() => result.current.rangeSelect(3, allIds));
    expect(result.current.isSelected(3)).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });
});
