import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { type ReactNode } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/projects/1/board',
  useSearchParams: () => new URLSearchParams(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, screen, act, fireEvent, within } from '@/tests/utils/component-test-utils';
import { DndContext } from '@dnd-kit/core';
import { StageColumn } from '@/components/board/stage-column';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/lib/types';
import { queryKeys } from '@/app/lib/query-keys';
import {
  useShipInfiniteLoad,
  useTicketsByStage,
  type ShipLoadStatus,
} from '@/app/lib/hooks/queries/useTickets';

function makeTicket(overrides: Partial<TicketWithVersion>): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Sample',
    description: 'desc',
    stage: 'SHIP',
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: false,
    workflowType: 'FULL',
    attachments: [],
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    qualityScore: null,
    jobs: [],
    ...overrides,
  } as unknown as TicketWithVersion;
}

function makeShipTickets(count: number, startId = 1): TicketWithVersion[] {
  return Array.from({ length: count }, (_, i) =>
    makeTicket({ id: startId + i, ticketNumber: startId + i, ticketKey: `AIB-${startId + i}` })
  );
}

// Controllable IntersectionObserver mock
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  elements: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.elements.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }

  trigger(isIntersecting: boolean) {
    act(() => {
      this.callback(
        [{ isIntersecting, target: this.elements[0] } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    });
  }
}

function latestObserver(): MockIntersectionObserver {
  const active = MockIntersectionObserver.instances.filter((o) => !o.disconnected);
  const observer = active[active.length - 1];
  if (!observer) throw new Error('No active IntersectionObserver');
  return observer;
}

interface ShipColumnProps {
  tickets?: TicketWithVersion[];
  stage?: Stage;
  totalCount?: number;
  hasMore?: boolean;
  loadStatus?: ShipLoadStatus;
  onLoadMore?: () => void;
  onRetryLoad?: () => void;
  isLoadPaused?: boolean;
}

function ShipColumn({ tickets = makeShipTickets(50), stage = Stage.SHIP, ...rest }: ShipColumnProps) {
  return (
    <DndContext>
      <StageColumn stage={stage} tickets={tickets} projectId={1} {...rest} />
    </DndContext>
  );
}

/** Queries scoped to the rendered column (DndContext adds its own role="status" live region). */
function column() {
  return within(screen.getByTestId(/^column-/));
}

function renderShipColumn(props: ShipColumnProps = {}) {
  const result = renderWithProviders(<ShipColumn {...props} />);
  return {
    ...result,
    rerenderColumn: (next: ShipColumnProps) => result.rerender(<ShipColumn {...next} />),
  };
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('StageColumn SHIP infinite scroll', () => {
  const baseProps = (): ShipColumnProps => ({
    totalCount: 120,
    hasMore: true,
    loadStatus: 'idle',
    onLoadMore: vi.fn(),
    onRetryLoad: vi.fn(),
  });

  it('renders a sentinel and no Load more button', () => {
    renderShipColumn(baseProps());
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
    expect(screen.getByTestId('ship-load-sentinel')).toBeInTheDocument();
  });

  it('calls onLoadMore once when the sentinel intersects', () => {
    const props = baseProps();
    renderShipColumn(props);
    latestObserver().trigger(true);
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('observes with a 300px bottom root margin', () => {
    renderShipColumn(baseProps());
    expect(latestObserver().options?.rootMargin).toBe('0px 0px 300px 0px');
  });

  it('uses the column scroll viewport as the observer root', () => {
    const { container } = renderShipColumn(baseProps());
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
    expect(viewport).not.toBeNull();
    expect(latestObserver().options?.root).toBe(viewport);
  });

  it('shows an accessible spinner while loading', () => {
    renderShipColumn({ ...baseProps(), loadStatus: 'loading' });
    expect(column().getByRole('status')).toHaveTextContent('Loading more shipped tickets');
  });

  it('renders nothing and never loads when hasMore is false', () => {
    const props = { ...baseProps(), hasMore: false };
    renderShipColumn(props);
    expect(screen.queryByTestId('ship-load-sentinel')).toBeNull();
    expect(column().queryByRole('status')).toBeNull();
    MockIntersectionObserver.instances.forEach((o) => o.trigger(true));
    expect(props.onLoadMore).not.toHaveBeenCalled();
  });

  it('shows loaded/total in the header', () => {
    renderShipColumn(baseProps());
    expect(screen.getByText('50/120')).toBeInTheDocument();
  });

  it('keeps the empty state when SHIP has no tickets', () => {
    renderShipColumn({ ...baseProps(), tickets: [], totalCount: 0, hasMore: false });
    expect(screen.getByText('No tickets')).toBeInTheDocument();
    expect(screen.queryByTestId('ship-load-sentinel')).toBeNull();
    expect(column().queryByRole('status')).toBeNull();
  });

  it('does not render the load region for non-SHIP columns', () => {
    renderShipColumn({ stage: Stage.VERIFY, tickets: [makeTicket({ stage: 'VERIFY' })] });
    expect(screen.queryByTestId('ship-load-sentinel')).toBeNull();
    expect(column().queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not call onLoadMore while a load is in progress', () => {
    const props = { ...baseProps(), loadStatus: 'loading' as const };
    renderShipColumn(props);
    latestObserver().trigger(true);
    latestObserver().trigger(false);
    latestObserver().trigger(true);
    expect(props.onLoadMore).not.toHaveBeenCalled();
  });

  it('shows an error alert with Retry and stops auto-loading', () => {
    const props = { ...baseProps(), loadStatus: 'error' as const };
    renderShipColumn(props);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load more tickets.");
    expect(screen.queryByTestId('ship-load-sentinel')).toBeNull();
    MockIntersectionObserver.instances.forEach((o) => o.trigger(true));
    expect(props.onLoadMore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(props.onRetryLoad).toHaveBeenCalledTimes(1);
  });

  describe('tall columns', () => {
    it('loads the next batch when the sentinel is still visible after an append', () => {
      const props = baseProps();
      const { rerenderColumn } = renderShipColumn(props);
      latestObserver().trigger(true);
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);

      rerenderColumn({ ...props, loadStatus: 'loading' });
      rerenderColumn({ ...props, loadStatus: 'idle', tickets: makeShipTickets(100) });
      expect(props.onLoadMore).toHaveBeenCalledTimes(2);
    });

    it('stops once hasMore becomes false', () => {
      const props = baseProps();
      const { rerenderColumn } = renderShipColumn(props);
      latestObserver().trigger(true);
      rerenderColumn({ ...props, loadStatus: 'loading' });
      rerenderColumn({ ...props, hasMore: false, tickets: makeShipTickets(100) });
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('stops on error', () => {
      const props = baseProps();
      const { rerenderColumn } = renderShipColumn(props);
      latestObserver().trigger(true);
      rerenderColumn({ ...props, loadStatus: 'loading' });
      rerenderColumn({ ...props, loadStatus: 'error' });
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('drag & drop', () => {
    it('pauses loading during a drag and resumes after', () => {
      const props = { ...baseProps(), isLoadPaused: true };
      const { rerenderColumn } = renderShipColumn(props);
      latestObserver().trigger(true);
      expect(props.onLoadMore).not.toHaveBeenCalled();

      rerenderColumn({ ...props, isLoadPaused: false });
      expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('never shows a loaded count above the total after a drop into SHIP', () => {
      renderShipColumn({ ...baseProps(), tickets: makeShipTickets(51, 1001), totalCount: Math.max(50, 51), hasMore: false });
      expect(screen.getByText('51')).toBeInTheDocument();
      expect(screen.queryByText('51/50')).toBeNull();
    });
  });
});

describe('useShipInfiniteLoad', () => {
  const projectId = 7;
  const ticketsKey = queryKeys.projects.tickets(projectId);
  let queryClient: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  function jsonResponse(body: unknown, ok = true) {
    return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  /** Renders the hook with loadedShipCount derived from the cache, like Board does. */
  function renderLoadHook(shipTotal: number) {
    return renderHook(
      ({ total }: { total: number }) => {
        const [count, setCount] = React.useState(
          () => (queryClient.getQueryData<TicketWithVersion[]>(ticketsKey) ?? []).filter((t) => t.stage === 'SHIP').length
        );
        React.useEffect(
          () =>
            queryClient.getQueryCache().subscribe(() => {
              setCount(
                (queryClient.getQueryData<TicketWithVersion[]>(ticketsKey) ?? []).filter((t) => t.stage === 'SHIP').length
              );
            }),
          []
        );
        return useShipInfiniteLoad(projectId, count, total);
      },
      { wrapper, initialProps: { total: shipTotal } }
    );
  }

  const cachedIds = () => (queryClient.getQueryData<TicketWithVersion[]>(ticketsKey) ?? []).map((t) => t.id);

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('fetches the next batch at the loaded offset and appends it to the cache', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const { result } = renderLoadHook(120);

    act(() => result.current.loadMore());
    expect(fetchMock).toHaveBeenCalledWith(`/api/projects/${projectId}/tickets?stage=SHIP&offset=50&limit=50`);
    expect(result.current.status).toBe('loading');

    await act(async () => pending.resolve(jsonResponse({ tickets: makeShipTickets(50, 51) })));
    expect(result.current.status).toBe('idle');
    expect(cachedIds()).toHaveLength(100);
    expect(result.current.hasMore).toBe(true);
  });

  it('reports hasMore=false and does not fetch when everything is loaded', () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(20));
    const { result } = renderLoadHook(20);
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a single request when loadMore is called repeatedly', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    const { result } = renderLoadHook(120);

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(jsonResponse({ tickets: makeShipTickets(50, 51) })));
  });

  it('drops batch tickets already in the cache, including other stages', async () => {
    queryClient.setQueryData(ticketsKey, [...makeShipTickets(50), makeTicket({ id: 200, stage: 'VERIFY' })]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ tickets: [makeTicket({ id: 50 }), makeTicket({ id: 200 }), makeTicket({ id: 201 })] })
    );
    const { result } = renderLoadHook(120);

    await act(async () => result.current.loadMore());
    const ids = cachedIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(52);
    expect(ids[ids.length - 1]).toBe(201);
  });

  it('stops after an empty batch', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: [] }));
    const { result } = renderLoadHook(120);

    await act(async () => result.current.loadMore());
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops after an all-duplicate batch', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: makeShipTickets(10, 41) }));
    const { result } = renderLoadHook(120);

    await act(async () => result.current.loadMore());
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enters error state on failure and only resumes through retry', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
    const { result } = renderLoadHook(120);

    await act(async () => result.current.loadMore());
    expect(result.current.status).toBe('error');
    expect(cachedIds()).toHaveLength(50);

    act(() => result.current.loadMore());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: makeShipTickets(50, 51) }));
    await act(async () => result.current.retry());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/projects/${projectId}/tickets?stage=SHIP&offset=50&limit=50`);
    expect(result.current.status).toBe('idle');
    expect(cachedIds()).toHaveLength(100);

    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: makeShipTickets(20, 101) }));
    await act(async () => result.current.loadMore());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('ignores a response that settles after unmount', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    const first = deferred<Response>();
    fetchMock.mockReturnValueOnce(first.promise);
    const { result, unmount } = renderLoadHook(120);

    act(() => result.current.loadMore());
    unmount();
    await act(async () => first.reject(new Error('network')));
    expect(console.error).not.toHaveBeenCalled();
    expect(cachedIds()).toHaveLength(50);
  });

  it('re-enables loading when the SHIP total changes after exhaustion', async () => {
    queryClient.setQueryData(ticketsKey, makeShipTickets(50));
    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: [] }));
    const { result, rerender } = renderLoadHook(120);

    await act(async () => result.current.loadMore());
    expect(result.current.hasMore).toBe(false);

    rerender({ total: 121 });
    expect(result.current.hasMore).toBe(true);
    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: makeShipTickets(1, 51) }));
    await act(async () => result.current.loadMore());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('tickets query refresh', () => {
  it('keeps SHIP tickets loaded by scrolling after a background refetch', async () => {
    const projectId = 9;
    const ticketsKey = queryKeys.projects.tickets(projectId);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    queryClient.setQueryData(ticketsKey, makeShipTickets(100));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        INBOX: [],
        SPECIFY: [],
        PLAN: [],
        BUILD: [],
        VERIFY: [],
        SHIP: makeShipTickets(50),
        _shipTotal: 120,
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTicketsByStage(projectId), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ticketsKey });
    });
    expect(fetchMock).toHaveBeenCalled();

    await waitFor(() => expect(result.current.data?.SHIP).toHaveLength(100));
    const ids = (queryClient.getQueryData<TicketWithVersion[]>(ticketsKey) ?? []).map((t) => t.id);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
  });
});
