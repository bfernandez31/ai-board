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

import { renderWithProviders, screen, act, userEvent } from '@/tests/utils/component-test-utils';
import { DndContext } from '@dnd-kit/core';
import { StageColumn } from '@/components/board/stage-column';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(id: number): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title: `Shipped ${id}`,
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
  } as unknown as TicketWithVersion;
}

/** Controllable IntersectionObserver stand-in (jsdom has none). */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly options: IntersectionObserverInit | undefined;
  private readonly callback: IntersectionObserverCallback;
  targets: Element[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.targets = [];
  }
  takeRecords() {
    return [];
  }
  trigger(isIntersecting: boolean) {
    this.callback(
      this.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver
    );
  }
}

function setSentinelVisible(isVisible: boolean) {
  act(() => {
    for (const io of MockIntersectionObserver.instances) io.trigger(isVisible);
  });
}

const tickets = [makeTicket(1), makeTicket(2)];

function renderShip(props: Partial<React.ComponentProps<typeof StageColumn>> = {}) {
  return renderWithProviders(
    <DndContext>
      <StageColumn stage={Stage.SHIP} tickets={tickets} projectId={1} totalCount={10} {...props} />
    </DndContext>
  );
}

describe('StageColumn SHIP infinite scroll', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no longer renders a "Load more" button', () => {
    renderShip({ onLoadMore: vi.fn() });
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows the loaded/total counter in the header', () => {
    renderShip({ onLoadMore: vi.fn() });
    expect(screen.getByText('2/10')).toBeInTheDocument();
  });

  it('observes the sentinel inside the column viewport with a pre-load margin', () => {
    renderShip({ onLoadMore: vi.fn() });
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    const io = MockIntersectionObserver.instances[0]!;
    expect(io.targets[0]).toBe(screen.getByTestId('ship-load-more-sentinel'));
    expect(io.options?.root).toBeInstanceOf(HTMLElement);
    expect(io.options?.rootMargin).toMatch(/^0px 0px \d+px 0px$/);
  });

  it('does not load until the bottom of the list approaches', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore });
    expect(onLoadMore).not.toHaveBeenCalled();
    setSentinelVisible(false);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('loads the next batch automatically when the sentinel becomes visible', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore });
    setSentinelVisible(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not fire concurrent loads while a batch is loading', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore, isLoadingMore: true });
    setSentinelVisible(true);
    setSentinelVisible(false);
    setSentinelVisible(true);
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: /loading more tickets/i })).toBeInTheDocument();
  });

  it('keeps loading until the column is filled when the sentinel stays visible', () => {
    const onLoadMore = vi.fn();
    const { rerender } = renderShip({ onLoadMore });
    setSentinelVisible(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Batch in flight, then appended: sentinel still visible (tall screen) → next batch
    const wrap = (ui: React.ReactElement) => <DndContext>{ui}</DndContext>;
    rerender(
      wrap(
        <StageColumn stage={Stage.SHIP} tickets={tickets} projectId={1} totalCount={10} onLoadMore={onLoadMore} isLoadingMore />
      )
    );
    const more = [...tickets, makeTicket(3), makeTicket(4)];
    const nextLoad = vi.fn();
    rerender(
      wrap(<StageColumn stage={Stage.SHIP} tickets={more} projectId={1} totalCount={10} onLoadMore={nextLoad} />)
    );
    expect(nextLoad).toHaveBeenCalledTimes(1);
  });

  it('stops observing once every ticket is loaded', () => {
    renderShip({ totalCount: 2 });
    expect(screen.queryByTestId('ship-load-more-sentinel')).not.toBeInTheDocument();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(screen.queryByText('2/2')).not.toBeInTheDocument();
  });

  it('shows an error with retry and does not auto-retry a failed load', async () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore, hasLoadMoreError: true });
    setSentinelVisible(true);
    expect(onLoadMore).not.toHaveBeenCalled();

    expect(screen.getByText(/couldn.t load more tickets/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('pauses auto-loading while paused (e.g. during drag)', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore, isLoadMorePaused: true });
    setSentinelVisible(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not set up infinite scroll on non-paginated columns', () => {
    renderWithProviders(
      <DndContext>
        <StageColumn stage={Stage.VERIFY} tickets={tickets} projectId={1} />
      </DndContext>
    );
    expect(screen.queryByTestId('ship-load-more-sentinel')).not.toBeInTheDocument();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });
});
