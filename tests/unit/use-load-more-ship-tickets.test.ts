import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useLoadMoreShipTickets, useTicketsByStage } from '@/app/lib/hooks/queries/useTickets';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/lib/types';

const PROJECT_ID = 1;
const ticketsKey = queryKeys.projects.tickets(PROJECT_ID);
const shipTotalKey = queryKeys.projects.shipTotal(PROJECT_ID);

function makeTicket(id: number, stage: string = 'SHIP'): TicketWithVersion {
  return { id, stage, ticketKey: `AIB-${id}` } as unknown as TicketWithVersion;
}

function makeShipTickets(count: number, startId = 1): TicketWithVersion[] {
  return Array.from({ length: count }, (_, i) => makeTicket(startId + i));
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function errorResponse(status = 500): Response {
  return { ok: false, status, json: async () => ({}) } as Response;
}

describe('useLoadMoreShipTickets', () => {
  let queryClient: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  function renderLoadMore() {
    return renderHook(() => useLoadMoreShipTickets(PROJECT_ID), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    });
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('issues a single request for two synchronous loadMore() calls (FR-004)', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    queryClient.setQueryData(shipTotalKey, 120);
    fetchMock.mockResolvedValue(okResponse({ tickets: makeShipTickets(50, 51) }));

    const { result } = renderLoadMore();
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the SHIP count in cache as offset, ignoring other stages', async () => {
    queryClient.setQueryData(ticketsKey, [
      ...makeShipTickets(50),
      makeTicket(900, 'INBOX'),
      makeTicket(901, 'BUILD'),
    ]);
    fetchMock.mockResolvedValue(okResponse({ tickets: [] }));

    const { result } = renderLoadMore();
    act(() => result.current.loadMore());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/tickets?stage=SHIP&offset=50&limit=50`
    );
  });

  it('does not append tickets already in the cache in any stage (FR-005)', async () => {
    queryClient.setQueryData(ticketsKey, [makeTicket(1), makeTicket(2, 'VERIFY')]);
    queryClient.setQueryData(shipTotalKey, 10);
    fetchMock.mockResolvedValue(okResponse({ tickets: [makeTicket(1), makeTicket(2), makeTicket(3)] }));

    const { result } = renderLoadMore();
    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(queryClient.getQueryData<TicketWithVersion[]>(ticketsKey)).toHaveLength(3)
    );
    const ids = queryClient.getQueryData<TicketWithVersion[]>(ticketsKey)!.map((t) => t.id);
    expect(ids).toEqual([1, 2, 3]);
    expect(queryClient.getQueryData(shipTotalKey)).toBe(10);
  });

  it('reconciles shipTotal to the loaded SHIP count on an empty batch (FR-006)', async () => {
    queryClient.setQueryData(ticketsKey, [...makeShipTickets(50), makeTicket(900, 'INBOX')]);
    queryClient.setQueryData(shipTotalKey, 60);
    fetchMock.mockResolvedValue(okResponse({ tickets: [] }));

    const { result } = renderLoadMore();
    act(() => result.current.loadMore());

    await waitFor(() => expect(queryClient.getQueryData(shipTotalKey)).toBe(50));
  });

  it('reconciles shipTotal when a batch contains only duplicates (FR-006)', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(3));
    queryClient.setQueryData(shipTotalKey, 8);
    fetchMock.mockResolvedValue(okResponse({ tickets: makeShipTickets(3) }));

    const { result } = renderLoadMore();
    act(() => result.current.loadMore());

    await waitFor(() => expect(queryClient.getQueryData(shipTotalKey)).toBe(3));
  });

  it('exposes the error, keeps the cache, and recovers on retry (FR-008)', async () => {
    const initial = makeShipTickets(50);
    queryClient.setQueryData(ticketsKey, initial);
    queryClient.setQueryData(shipTotalKey, 120);
    fetchMock.mockResolvedValueOnce(errorResponse(500));

    const { result } = renderLoadMore();
    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isLoading).toBe(false);
    expect(queryClient.getQueryData(ticketsKey)).toBe(initial);

    // Guard is released after failure — Retry issues a new request with the same offset
    fetchMock.mockResolvedValueOnce(okResponse({ tickets: makeShipTickets(50, 51) }));
    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.error).toBeNull());
    await waitFor(() =>
      expect(queryClient.getQueryData<TicketWithVersion[]>(ticketsKey)).toHaveLength(100)
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/projects/${PROJECT_ID}/tickets?stage=SHIP&offset=50&limit=50`
    );
  });

  it('allows a new request after a successful batch settles', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    queryClient.setQueryData(shipTotalKey, 150);
    fetchMock
      .mockResolvedValueOnce(okResponse({ tickets: makeShipTickets(50, 51) }))
      .mockResolvedValueOnce(okResponse({ tickets: makeShipTickets(50, 101) }));

    const { result } = renderLoadMore();
    act(() => result.current.loadMore());
    await waitFor(() =>
      expect(queryClient.getQueryData<TicketWithVersion[]>(ticketsKey)).toHaveLength(100)
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() =>
      expect(queryClient.getQueryData<TicketWithVersion[]>(ticketsKey)).toHaveLength(150)
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/projects/${PROJECT_ID}/tickets?stage=SHIP&offset=100&limit=50`
    );
  });

  describe('tickets refetch (FR-010)', () => {
    function renderBoardQuery() {
      return renderHook(() => useTicketsByStage(PROJECT_ID), {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client: queryClient }, children),
      });
    }

    it('requests shipLimit equal to the loaded SHIP count when above one batch', async () => {
      queryClient.setQueryData(ticketsKey, makeShipTickets(120));
      fetchMock.mockResolvedValue(
        okResponse({ INBOX: [], SHIP: makeShipTickets(120), _shipTotal: 300 })
      );

      renderBoardQuery();
      await act(() => queryClient.refetchQueries({ queryKey: ticketsKey, exact: true }));

      expect(fetchMock).toHaveBeenCalledWith(`/api/projects/${PROJECT_ID}/tickets?shipLimit=120`);
      expect(queryClient.getQueryData(shipTotalKey)).toBe(300);
      expect(queryClient.getQueryData<TicketWithVersion[]>(ticketsKey)).toHaveLength(120);
    });

    it('requests the default batch size when fewer SHIP tickets are loaded', async () => {
      queryClient.setQueryData(ticketsKey, makeShipTickets(10));
      fetchMock.mockResolvedValue(okResponse({ SHIP: makeShipTickets(10), _shipTotal: 10 }));

      renderBoardQuery();
      await act(() => queryClient.refetchQueries({ queryKey: ticketsKey, exact: true }));

      expect(fetchMock).toHaveBeenCalledWith(`/api/projects/${PROJECT_ID}/tickets?shipLimit=50`);
      expect(queryClient.getQueryData(shipTotalKey)).toBe(10);
    });
  });
});
