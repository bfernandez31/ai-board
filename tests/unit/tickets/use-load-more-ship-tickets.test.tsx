import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/tests/helpers/test-query-client';
import { useLoadMoreShipTickets } from '@/app/lib/hooks/queries/useTickets';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';

const t = (id: number) => ({ id, stage: 'SHIP' }) as unknown as TicketWithVersion;

function setup(initial: TicketWithVersion[]) {
  const queryClient = createTestQueryClient();
  // Keep the observer-less cache entry alive (test client defaults to gcTime 0)
  queryClient.setQueryDefaults(queryKeys.projects.tickets(1), { gcTime: Infinity });
  queryClient.setQueryData(queryKeys.projects.tickets(1), initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useLoadMoreShipTickets(1), { wrapper });
  return { queryClient, ...hook };
}

describe('useLoadMoreShipTickets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores calls while a batch is in flight (single request)', async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal('fetch', fetchMock);
    const { result, queryClient } = setup([t(1), t(2)]);

    act(() => {
      result.current.loadMore(2);
      result.current.loadMore(2);
      result.current.loadMore(2);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.isLoading).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/1/tickets?stage=SHIP&offset=2&limit=50');

    await act(async () => {
      resolve(new Response(JSON.stringify({ tickets: [t(3)] })));
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(
      queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(1))?.map((x) => x.id)
    ).toEqual([1, 2, 3]);

    // Guard released after completion
    act(() => result.current.loadMore(3));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('does not append tickets already present in the cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ tickets: [t(2), t(3)] })))
    );
    const { result, queryClient } = setup([t(1), t(2)]);

    act(() => result.current.loadMore(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(
      queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(1))?.map((x) => x.id)
    ).toEqual([1, 2, 3]);
  });

  it('exposes the error and allows an explicit retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tickets: [t(3)] })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = setup([t(1), t(2)]);

    act(() => result.current.loadMore(2));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => result.current.loadMore(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
