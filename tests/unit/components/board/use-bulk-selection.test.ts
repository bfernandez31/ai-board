import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBulkSelection } from '@/components/board/hooks/use-bulk-selection';

const ALL_IDS = [101, 102, 103, 104, 105];

describe('useBulkSelection', () => {
  it('starts empty and not in select mode', () => {
    const { result } = renderHook(() => useBulkSelection(ALL_IDS));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.anchorId).toBeNull();
  });

  it('toggle adds and removes ids and tracks anchor', () => {
    const { result } = renderHook(() => useBulkSelection(ALL_IDS));
    act(() => result.current.toggle(102));
    expect(result.current.selectedIds.has(102)).toBe(true);
    expect(result.current.isSelectMode).toBe(true);
    expect(result.current.anchorId).toBe(102);

    act(() => result.current.toggle(104));
    expect(result.current.selectedIds.has(104)).toBe(true);
    expect(result.current.anchorId).toBe(104);

    act(() => result.current.toggle(102));
    expect(result.current.selectedIds.has(102)).toBe(false);
    expect(result.current.anchorId).toBe(102);
  });

  it('rangeSelectTo selects forward range inclusive', () => {
    const { result } = renderHook(() => useBulkSelection(ALL_IDS));
    act(() => result.current.toggle(101));
    act(() => result.current.rangeSelectTo(104, ALL_IDS));
    expect(Array.from(result.current.selectedIds).sort((a, b) => a - b)).toEqual([
      101, 102, 103, 104,
    ]);
    expect(result.current.anchorId).toBe(104);
  });

  it('rangeSelectTo selects backward range inclusive', () => {
    const { result } = renderHook(() => useBulkSelection(ALL_IDS));
    act(() => result.current.toggle(105));
    act(() => result.current.rangeSelectTo(102, ALL_IDS));
    expect(Array.from(result.current.selectedIds).sort((a, b) => a - b)).toEqual([
      102, 103, 104, 105,
    ]);
  });

  it('rangeSelectTo falls back to toggle when no anchor exists', () => {
    const { result } = renderHook(() => useBulkSelection(ALL_IDS));
    act(() => result.current.rangeSelectTo(103, ALL_IDS));
    expect(result.current.selectedIds.has(103)).toBe(true);
  });

  it('clear exits select mode', () => {
    const { result } = renderHook(() => useBulkSelection(ALL_IDS));
    act(() => result.current.toggle(101));
    act(() => result.current.toggle(102));
    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.anchorId).toBeNull();
  });

  it('drops selected ids that vanish from the inbox', () => {
    const { result, rerender } = renderHook(({ ids }) => useBulkSelection(ids), {
      initialProps: { ids: ALL_IDS },
    });
    act(() => result.current.toggle(101));
    act(() => result.current.toggle(102));
    rerender({ ids: [101, 103] });
    expect(result.current.selectedIds.has(101)).toBe(true);
    expect(result.current.selectedIds.has(102)).toBe(false);
  });

  it('clears anchor when the anchor ticket leaves the inbox', () => {
    const { result, rerender } = renderHook(({ ids }) => useBulkSelection(ids), {
      initialProps: { ids: ALL_IDS },
    });
    act(() => result.current.toggle(103));
    rerender({ ids: [101, 102] });
    expect(result.current.anchorId).toBeNull();
  });
});
