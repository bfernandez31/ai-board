import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '@/tests/helpers/test-query-client';
import { queryKeys } from '@/app/lib/query-keys';
import { useLoadMoreShipTickets, useProjectTickets } from '@/app/lib/hooks/queries/useTickets';
import type { TicketWithVersion } from '@/lib/types';

const PROJECT_ID = 1;

function ship(id: number): TicketWithVersion {
  return { id, ticketKey: `AIB-${id}`, title: `[e2e] ${id}`, stage: 'SHIP' } as unknown as TicketWithVersion;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

describe('useLoadMoreShipTickets', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup() {
    const queryClient = createTestQueryClient();
    // Keep observer-less cache data alive (test client defaults to gcTime 0)
    queryClient.setQueryDefaults(queryKeys.projects.tickets(PROJECT_ID), { gcTime: Infinity });
    queryClient.setQueryData(queryKeys.projects.tickets(PROJECT_ID), [ship(1), ship(2)]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, wrapper };
  }

  it('makes only one request when loadMore is called while pending', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ tickets: [ship(3)] }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLoadMoreShipTickets(PROJECT_ID), { wrapper });

    act(() => {
      result.current.loadMore(2);
      result.current.loadMore(2);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes appended tickets by id', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ tickets: [ship(2), ship(3)] }));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useLoadMoreShipTickets(PROJECT_ID), { wrapper });

    act(() => result.current.loadMore(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const cached = queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(PROJECT_ID));
    expect(cached?.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it('exposes isError on failure, keeps cache, and reset clears it', async () => {
    fetchMock.mockImplementation(() => jsonResponse({}, false, 500));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useLoadMoreShipTickets(PROJECT_ID), { wrapper });

    act(() => result.current.loadMore(2));
    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(PROJECT_ID));
    expect(cached).toHaveLength(2);

    act(() => result.current.reset());
    await waitFor(() => expect(result.current.isError).toBe(false));
  });

  it('allows another request after a failure', async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({}, false, 500));
    fetchMock.mockImplementationOnce(() => jsonResponse({ tickets: [ship(3)] }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLoadMoreShipTickets(PROJECT_ID), { wrapper });

    act(() => result.current.loadMore(2));
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.loadMore(2));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe('ticket refetch preserves loaded SHIP tickets', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests shipLimit equal to the cached SHIP count when above 50', async () => {
    const shipTickets = Array.from({ length: 60 }, (_, i) => ship(i + 1));
    fetchMock.mockImplementation(() => jsonResponse({ SHIP: shipTickets, INBOX: [], _shipTotal: 80 }));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.projects.tickets(PROJECT_ID), shipTickets);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useProjectTickets(PROJECT_ID), { wrapper });
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).toHaveBeenCalledWith(`/api/projects/${PROJECT_ID}/tickets?shipLimit=60`);
    expect(result.current.data).toHaveLength(60);
  });

  it('omits shipLimit when 50 or fewer SHIP tickets are loaded', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ SHIP: [ship(1)], _shipTotal: 1 }));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.projects.tickets(PROJECT_ID), [ship(1)]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useProjectTickets(PROJECT_ID), { wrapper });
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).toHaveBeenCalledWith(`/api/projects/${PROJECT_ID}/tickets`);
  });
});
