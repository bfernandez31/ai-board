import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  SHIP_BATCH_SIZE,
  useLoadMoreShipTickets,
  useProjectTickets,
} from '@/app/lib/hooks/queries/useTickets';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';

const projectId = 1;

function makeShipTicket(id: number, stage = 'SHIP', title = `[e2e] Ticket ${id}`): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title,
    description: 'desc',
    stage,
    version: 1,
    projectId,
    branch: null,
    previewUrl: null,
    autoMode: false,
    workflowType: 'FULL',
    attachments: [],
    clarificationPolicy: null,
    agent: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [],
  } as unknown as TicketWithVersion;
}

function batchOf(n: number, startId: number, stage = 'SHIP'): TicketWithVersion[] {
  return Array.from({ length: n }, (_, i) => makeShipTicket(startId + i, stage));
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => body } as Response);
}

describe('useLoadMoreShipTickets', () => {
  let queryClient: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  function seed(tickets: TicketWithVersion[], shipTotal: number) {
    queryClient.setQueryData(queryKeys.projects.tickets(projectId), tickets);
    queryClient.setQueryData(queryKeys.projects.shipTotal(projectId), shipTotal);
  }

  function cached(): TicketWithVersion[] {
    return queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId)) ?? [];
  }

  function renderLoadMore(shipTotal: number) {
    return renderHook(({ total }) => useLoadMoreShipTickets(projectId, total), {
      wrapper,
      initialProps: { total: shipTotal },
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
    queryClient.clear();
  });

  describe('US1 - automatic batches', () => {
    it('fetches the next batch and appends it in order', async () => {
      seed(batchOf(50, 1), 120);
      let resolve!: (v: Response) => void;
      fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
      const { result } = renderLoadMore(120);

      act(() => result.current.loadMore(50));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]![0]).toContain(`stage=SHIP&offset=50&limit=${SHIP_BATCH_SIZE}`);
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolve({ ok: true, status: 200, json: async () => ({ tickets: batchOf(50, 51) }) } as Response);
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(cached().map((t) => t.id)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
      expect(result.current.isExhausted).toBe(false);
    });

    it('marks exhausted on a short batch and stops fetching', async () => {
      seed(batchOf(100, 1), 120);
      fetchMock.mockReturnValue(jsonResponse({ tickets: batchOf(20, 101) }));
      const { result } = renderLoadMore(120);

      act(() => result.current.loadMore(100));
      await waitFor(() => expect(result.current.isExhausted).toBe(true));

      act(() => result.current.loadMore(120));
      await new Promise((r) => setTimeout(r, 20));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('marks exhausted on an empty batch', async () => {
      seed(batchOf(50, 1), 120);
      fetchMock.mockReturnValue(jsonResponse({ tickets: [] }));
      const { result } = renderLoadMore(120);

      act(() => result.current.loadMore(50));
      await waitFor(() => expect(result.current.isExhausted).toBe(true));
    });
  });

  describe('US2 - reliability', () => {
    it('keeps at most one request in flight', async () => {
      seed(batchOf(50, 1), 120);
      fetchMock.mockReturnValue(new Promise(() => {}));
      const { result } = renderLoadMore(120);

      act(() => {
        result.current.loadMore(50);
        result.current.loadMore(50);
      });
      await waitFor(() => expect(result.current.isLoading).toBe(true));
      act(() => result.current.loadMore(50));
      await new Promise((r) => setTimeout(r, 20));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('deduplicates by id across all stages', async () => {
      seed([...batchOf(50, 1), makeShipTicket(60, 'VERIFY')], 120);
      fetchMock.mockReturnValue(
        jsonResponse({ tickets: [...batchOf(50, 45), makeShipTicket(60, 'SHIP')] })
      );
      const { result } = renderLoadMore(120);

      act(() => result.current.loadMore(50));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await waitFor(() => expect(cached().length).toBeGreaterThan(51));

      const ids = cached().map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(cached().filter((t) => t.id === 60)).toHaveLength(1);
      expect(cached().find((t) => t.id === 60)!.stage).toBe('VERIFY');
    });

    it('marks exhausted when a full batch adds nothing new', async () => {
      seed(batchOf(50, 1), 120);
      fetchMock.mockReturnValue(jsonResponse({ tickets: batchOf(50, 1) }));
      const { result } = renderLoadMore(120);

      act(() => result.current.loadMore(50));
      await waitFor(() => expect(result.current.isExhausted).toBe(true));
      expect(cached()).toHaveLength(50);
    });

    it('pauses on error and recovers with retry', async () => {
      seed(batchOf(50, 1), 120);
      fetchMock.mockReturnValueOnce(jsonResponse({}, false, 500));
      const { result } = renderLoadMore(120);

      act(() => result.current.loadMore(50));
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      act(() => result.current.loadMore(50));
      await new Promise((r) => setTimeout(r, 20));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fetchMock.mockReturnValueOnce(jsonResponse({ tickets: batchOf(50, 51) }));
      act(() => result.current.retry(50));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(fetchMock.mock.calls[1]![0]).toContain('offset=50');
      await waitFor(() => expect(result.current.isError).toBe(false));
      await waitFor(() => expect(cached()).toHaveLength(100));
    });
  });

  describe('US5 - polling merge', () => {
    function boardResponse(ship: TicketWithVersion[], shipTotal: number, extra: Partial<Record<string, TicketWithVersion[]>> = {}) {
      return jsonResponse({
        INBOX: [],
        SPECIFY: [],
        PLAN: [],
        BUILD: [],
        VERIFY: [],
        SHIP: ship,
        CLOSED: [],
        ...extra,
        _shipTotal: shipTotal,
      });
    }

    async function refetch(response: Promise<Response>) {
      fetchMock.mockReturnValueOnce(response);
      const { result } = renderHook(() => useProjectTickets(projectId), { wrapper });
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      });
      return result;
    }

    it('keeps already-loaded SHIP tickets after a refetch', async () => {
      seed(batchOf(100, 1), 120);
      await refetch(boardResponse(batchOf(50, 1), 120));

      const ship = cached().filter((t) => t.stage === 'SHIP');
      expect(ship).toHaveLength(100);
      expect(new Set(ship.map((t) => t.id)).size).toBe(100);
      expect(ship.slice(0, 50).map((t) => t.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    });

    it('does not keep a stale SHIP copy of a ticket that moved', async () => {
      seed(batchOf(100, 1), 120);
      await refetch(boardResponse(batchOf(50, 1), 119, { VERIFY: [makeShipTicket(70, 'VERIFY')] }));

      const copies = cached().filter((t) => t.id === 70);
      expect(copies).toHaveLength(1);
      expect(copies[0]!.stage).toBe('VERIFY');
    });

    it('drops stale extras when the fresh response holds every SHIP ticket', async () => {
      seed(batchOf(100, 1), 120);
      await refetch(boardResponse(batchOf(30, 1), 30));

      expect(cached().filter((t) => t.stage === 'SHIP')).toHaveLength(30);
    });

    it('lets fresh data win for ids present in both', async () => {
      seed(batchOf(100, 1), 120);
      const fresh = batchOf(50, 1);
      fresh[0] = makeShipTicket(1, 'SHIP', '[e2e] Updated title');
      await refetch(boardResponse(fresh, 120));

      expect(cached().find((t) => t.id === 1)!.title).toBe('[e2e] Updated title');
      expect(cached().filter((t) => t.id === 1)).toHaveLength(1);
    });

    it('clears exhaustion when shipTotal grows', async () => {
      seed(batchOf(100, 1), 120);
      fetchMock.mockReturnValue(jsonResponse({ tickets: batchOf(10, 101) }));
      const { result, rerender } = renderLoadMore(120);

      act(() => result.current.loadMore(100));
      await waitFor(() => expect(result.current.isExhausted).toBe(true));

      rerender({ total: 120 });
      expect(result.current.isExhausted).toBe(true);
      rerender({ total: 121 });
      expect(result.current.isExhausted).toBe(false);
    });
  });
});
