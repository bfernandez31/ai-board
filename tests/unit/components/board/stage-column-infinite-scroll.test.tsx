import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { renderWithProviders, screen, within, userEvent, act } from '@/tests/utils/component-test-utils';
import { DndContext } from '@dnd-kit/core';
import { StageColumn } from '@/components/board/stage-column';
import type { ShipInfiniteScrollState } from '@/components/board/ship-infinite-scroll-footer';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/lib/types';

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

function makeTickets(count: number, startId = 1): TicketWithVersion[] {
  return Array.from({ length: count }, (_, i) =>
    makeTicket({ id: startId + i, ticketNumber: startId + i, ticketKey: `AIB-${startId + i}` })
  );
}

/** Controllable IntersectionObserver stub (jsdom has none) */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  /** When true, observe() emits an initial isIntersecting entry like a browser would */
  static emitOnObserve = false;

  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  targets: Element[] = [];
  disconnected = false;
  disconnect = vi.fn(() => {
    this.disconnected = true;
  });

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
    if (MockIntersectionObserver.emitOnObserve) {
      this.emit(true);
    }
  }

  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  emit(isIntersecting: boolean) {
    const entries = this.targets.map(
      (target) => ({ isIntersecting, target }) as unknown as IntersectionObserverEntry
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

function activeObserver(): MockIntersectionObserver | undefined {
  return MockIntersectionObserver.instances.filter((o) => !o.disconnected).at(-1);
}

function trigger(isIntersecting: boolean) {
  act(() => {
    activeObserver()?.emit(isIntersecting);
  });
}

/** Scope to the column — DndContext renders its own role="status" live region */
function column() {
  return within(screen.getByTestId('column-SHIP'));
}

function makeState(overrides: Partial<ShipInfiniteScrollState> = {}): ShipInfiniteScrollState {
  return {
    hasMore: true,
    isLoading: false,
    error: null,
    paused: false,
    onLoadMore: vi.fn(),
    ...overrides,
  };
}

function renderShipColumn(
  state: ShipInfiniteScrollState,
  tickets: TicketWithVersion[] = makeTickets(50),
  totalCount = 120
) {
  const ui = (s: ShipInfiniteScrollState, t: TicketWithVersion[]) => (
    <DndContext>
      <StageColumn
        stage={Stage.SHIP}
        tickets={t}
        projectId={1}
        totalCount={totalCount}
        shipInfiniteScroll={s}
      />
    </DndContext>
  );
  const result = renderWithProviders(ui(state, tickets));
  return {
    ...result,
    rerenderWith: (s: ShipInfiniteScrollState, t: TicketWithVersion[] = tickets) =>
      result.rerender(ui(s, t)),
  };
}

describe('StageColumn SHIP infinite scroll', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    MockIntersectionObserver.emitOnObserve = false;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('US1: auto-load while scrolling', () => {
    it('renders no "Load more" button or text (FR-001)', () => {
      renderShipColumn(makeState());
      expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
      expect(screen.queryByText(/load more/i)).toBeNull();
    });

    it('calls onLoadMore once when the sentinel intersects (FR-002)', () => {
      const state = makeState();
      renderShipColumn(state);
      trigger(true);
      expect(state.onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('does not call onLoadMore when the sentinel is not intersecting', () => {
      const state = makeState();
      renderShipColumn(state);
      trigger(false);
      expect(state.onLoadMore).not.toHaveBeenCalled();
    });

    it('shows an accessible loading status while loading (FR-003/FR-015)', () => {
      renderShipColumn(makeState({ isLoading: true }));
      const status = column().getByRole('status');
      expect(status).toHaveTextContent('Loading more shipped tickets');
    });

    it('renders no sentinel or status and never loads when all tickets are loaded (FR-006)', () => {
      const state = makeState({ hasMore: false });
      renderShipColumn(state);
      expect(screen.queryByTestId('ship-scroll-sentinel')).toBeNull();
      expect(column().queryByRole('status')).toBeNull();
      trigger(true);
      expect(state.onLoadMore).not.toHaveBeenCalled();
    });

    it('shows the loaded/total badge (FR-007)', () => {
      renderShipColumn(makeState());
      expect(screen.getByText('50/120')).toBeInTheDocument();
    });

    it('observes within the column viewport with a 300px bottom margin (FR-002)', () => {
      renderShipColumn(makeState());
      const sentinel = screen.getByTestId('ship-scroll-sentinel');
      const viewport = sentinel.closest('[data-radix-scroll-area-viewport]');
      const observer = activeObserver();
      expect(viewport).not.toBeNull();
      expect(observer?.options?.root).toBe(viewport);
      expect(observer?.options?.rootMargin).toBe('0px 0px 300px 0px');
      expect(observer?.targets).toContain(sentinel);
    });
  });

  describe('US2: safe loading and errors', () => {
    it('does not call onLoadMore while a batch is loading (FR-004)', () => {
      const state = makeState({ isLoading: true });
      renderShipColumn(state);
      trigger(true);
      expect(state.onLoadMore).not.toHaveBeenCalled();
    });

    it('shows an error with Retry and pauses auto-loading (FR-008/FR-015)', async () => {
      const user = userEvent.setup();
      const state = makeState({ error: new Error('boom') });
      renderShipColumn(state);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent("Couldn't load more shipped tickets.");
      expect(column().queryByRole('status')).toBeNull();

      trigger(true);
      expect(state.onLoadMore).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(state.onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('US3: scroll stability', () => {
    it('renders the sentinel after the last card inside the viewport', () => {
      const tickets = makeTickets(3);
      renderShipColumn(makeState(), tickets, 10);
      const sentinel = screen.getByTestId('ship-scroll-sentinel');
      const viewport = sentinel.closest('[data-radix-scroll-area-viewport]');
      const lastCard = screen.getAllByTestId('ticket-card').at(-1)!;
      expect(viewport?.contains(lastCard)).toBe(true);
      expect(
        lastCard.compareDocumentPosition(sentinel) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('keeps existing card nodes when a batch is appended (FR-013)', () => {
      const state = makeState();
      const first = makeTickets(3);
      const { rerenderWith } = renderShipColumn(state, first, 10);
      const before = screen.getAllByTestId('ticket-card');

      rerenderWith(state, [...first, ...makeTickets(3, 4)]);

      const after = screen.getAllByTestId('ticket-card');
      expect(after).toHaveLength(6);
      before.forEach((node, i) => expect(after[i]).toBe(node));
    });

    it('disconnects the observer on unmount', () => {
      const { unmount } = renderShipColumn(makeState());
      const observer = activeObserver();
      unmount();
      expect(observer?.disconnect).toHaveBeenCalled();
    });
  });

  describe('US4: fill tall columns', () => {
    it('keeps loading one batch at a time while the sentinel stays in view (FR-009)', () => {
      MockIntersectionObserver.emitOnObserve = true;
      const onLoadMore = vi.fn();
      const { rerenderWith } = renderShipColumn(makeState({ onLoadMore }), makeTickets(50));
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      rerenderWith(makeState({ onLoadMore, isLoading: true }), makeTickets(50));
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      rerenderWith(makeState({ onLoadMore }), makeTickets(100));
      expect(onLoadMore).toHaveBeenCalledTimes(2);

      rerenderWith(makeState({ onLoadMore, hasMore: false }), makeTickets(120));
      expect(onLoadMore).toHaveBeenCalledTimes(2);
    });

    it('stops the chain when a batch fails', () => {
      MockIntersectionObserver.emitOnObserve = true;
      const onLoadMore = vi.fn();
      const { rerenderWith } = renderShipColumn(makeState({ onLoadMore }));
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      rerenderWith(makeState({ onLoadMore, error: new Error('fail') }));
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('US5: pause during drag', () => {
    it('ignores intersections while paused and resumes after drop (FR-011)', () => {
      const onLoadMore = vi.fn();
      const { rerenderWith } = renderShipColumn(makeState({ onLoadMore, paused: true }));

      trigger(true);
      expect(onLoadMore).not.toHaveBeenCalled();

      MockIntersectionObserver.emitOnObserve = true;
      rerenderWith(makeState({ onLoadMore, paused: false }));
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });
});
