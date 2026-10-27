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

import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from '@/tests/utils/component-test-utils';
import { DndContext } from '@dnd-kit/core';
import { StageColumn } from '@/components/board/stage-column';
import { useInfiniteScrollTrigger } from '@/components/board/hooks/use-infinite-scroll-trigger';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/lib/types';

// Controllable IntersectionObserver stub
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
}

function activeObserver(): MockIntersectionObserver {
  const active = MockIntersectionObserver.instances.filter((o) => !o.disconnected);
  const observer = active[active.length - 1];
  if (!observer) throw new Error('No active IntersectionObserver');
  return observer;
}

function triggerIntersect(isIntersecting: boolean) {
  const observer = activeObserver();
  act(() => {
    observer.callback(
      observer.observed.map(
        (target) => ({ isIntersecting, target }) as unknown as IntersectionObserverEntry
      ),
      observer as unknown as IntersectionObserver
    );
  });
}

function makeTicket(id: number): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title: `[e2e] Ship ticket ${id}`,
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

function tickets(n: number) {
  return Array.from({ length: n }, (_, i) => makeTicket(i + 1));
}

type ColumnProps = Partial<React.ComponentProps<typeof StageColumn>>;

function renderColumn(props: ColumnProps = {}) {
  const onLoadMore = props.onLoadMore ?? vi.fn();
  const base = {
    stage: Stage.SHIP,
    tickets: tickets(50),
    projectId: 1,
    totalCount: 120,
    hasMore: true,
    onLoadMore,
    ...props,
  };
  const view = renderWithProviders(
    <DndContext>
      <StageColumn {...base} />
    </DndContext>
  );
  const rerender = (next: ColumnProps) =>
    view.rerender(
      <DndContext>
        <StageColumn {...base} {...next} />
      </DndContext>
    );
  return { ...view, onLoadMore, rerender };
}

// Scope to the column: dnd-kit renders its own role="status" live region
function column() {
  return within(screen.getByTestId('column-SHIP'));
}

function viewport(container: HTMLElement) {
  return container.querySelector('[data-radix-scroll-area-viewport]');
}

describe('StageColumn infinite scroll (SHIP)', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('US1 - automatic loading', () => {
    it('renders no Load more button', () => {
      renderColumn();
      expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
    });

    it('loads once when the sentinel nears the column bottom', () => {
      const { onLoadMore, container } = renderColumn();
      const observer = activeObserver();
      expect(observer.options?.root).toBe(viewport(container));
      expect(observer.options?.root).not.toBeNull();
      expect(observer.options?.rootMargin).toBe('0px 0px 300px 0px');
      expect(observer.observed[0]).toBe(screen.getByTestId('ship-load-more-sentinel'));

      triggerIntersect(true);
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('shows an accessible spinner while loading', () => {
      const { rerender } = renderColumn();
      rerender({ isLoadingMore: true });
      expect(column().getByRole('status')).toHaveTextContent('Loading more tickets');
    });

    it('removes the sentinel and stops loading when nothing remains', () => {
      const { onLoadMore } = renderColumn({ hasMore: false });
      expect(screen.queryByTestId('ship-load-more-sentinel')).toBeNull();
      MockIntersectionObserver.instances.forEach((o) =>
        act(() =>
          o.callback(
            [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
            o as unknown as IntersectionObserver
          )
        )
      );
      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('shows loaded/total in the header, including when complete', () => {
      const { rerender } = renderColumn();
      expect(screen.getByText('50/120')).toBeInTheDocument();
      rerender({ tickets: tickets(120), hasMore: false });
      expect(screen.getByText('120/120')).toBeInTheDocument();
    });
  });

  describe('US2 - reliability', () => {
    it('does not trigger while a batch is loading', () => {
      const { onLoadMore } = renderColumn({ isLoadingMore: true });
      triggerIntersect(true);
      triggerIntersect(false);
      triggerIntersect(true);
      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('shows an inline error with Retry and pauses auto-loading', async () => {
      const onRetryLoadMore = vi.fn();
      const { onLoadMore } = renderColumn({ loadMoreError: true, onRetryLoadMore });
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load more tickets.");
      expect(column().queryByRole('status')).toBeNull();

      triggerIntersect(true);
      expect(onLoadMore).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetryLoadMore).toHaveBeenCalledTimes(1);
    });

    it('Retry is reachable by keyboard and activates with Enter', async () => {
      const onRetryLoadMore = vi.fn();
      renderColumn({ loadMoreError: true, onRetryLoadMore });
      const retry = screen.getByRole('button', { name: /retry/i });
      const user = userEvent.setup();
      for (let i = 0; i < 200 && document.activeElement !== retry; i++) {
        await user.tab();
      }
      expect(retry).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onRetryLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('US3 - mobile / scroll container', () => {
    it('observes the column ScrollArea viewport, not the page', () => {
      const { container } = renderColumn();
      const root = activeObserver().options?.root as Element;
      expect(root).toBeInstanceOf(HTMLElement);
      expect(root.hasAttribute('data-radix-scroll-area-viewport')).toBe(true);
      expect(container.contains(root)).toBe(true);
    });

    it('keeps existing cards when a batch is appended and renders status rows last', () => {
      const { rerender, container } = renderColumn();
      const firstCard = container.querySelector('[data-ticket-id="1"]') ?? screen.getByText('[e2e] Ship ticket 1');
      rerender({ tickets: tickets(100), isLoadingMore: true });
      const sameCard = container.querySelector('[data-ticket-id="1"]') ?? screen.getByText('[e2e] Ship ticket 1');
      expect(sameCard).toBe(firstCard);

      const sentinel = screen.getByTestId('ship-load-more-sentinel');
      const status = column().getByRole('status');
      const lastCard = screen.getByText('[e2e] Ship ticket 100');
      expect(lastCard.compareDocumentPosition(sentinel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(sentinel.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('US4 - auto-fill', () => {
    it('loads the next batch when loading ends while the sentinel is still visible', () => {
      const { onLoadMore, rerender } = renderColumn();
      triggerIntersect(true);
      expect(onLoadMore).toHaveBeenCalledTimes(1);
      rerender({ isLoadingMore: true });
      rerender({ isLoadingMore: false, tickets: tickets(100) });
      expect(onLoadMore).toHaveBeenCalledTimes(2);
    });

    it('stops auto-fill on error', () => {
      const { onLoadMore, rerender } = renderColumn();
      triggerIntersect(true);
      rerender({ isLoadingMore: true });
      rerender({ isLoadingMore: false, loadMoreError: true });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('stops auto-fill when everything is loaded', () => {
      const { onLoadMore, rerender } = renderColumn();
      triggerIntersect(true);
      rerender({ isLoadingMore: true });
      rerender({ isLoadingMore: false, hasMore: false, tickets: tickets(120) });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('US5 - drag & drop', () => {
    it('pauses while dragging and resumes on drag end', () => {
      const { onLoadMore, rerender } = renderColumn({ isLoadMorePaused: true });
      triggerIntersect(true);
      expect(onLoadMore).not.toHaveBeenCalled();
      rerender({ isLoadMorePaused: false });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('non-paginated columns', () => {
    it('renders no sentinel without onLoadMore', () => {
      renderWithProviders(
        <DndContext>
          <StageColumn stage={Stage.VERIFY} tickets={[]} projectId={1} />
        </DndContext>
      );
      expect(screen.queryByTestId('ship-load-more-sentinel')).toBeNull();
    });
  });
});

describe('useInfiniteScrollTrigger', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(initial: { enabled: boolean; prefetchDistancePx?: number }) {
    const rootRef = { current: document.createElement('div') };
    const sentinelRef = { current: document.createElement('div') };
    const onTrigger = vi.fn();
    const hook = renderHook(
      (props: { enabled: boolean; prefetchDistancePx?: number }) =>
        useInfiniteScrollTrigger({ rootRef, sentinelRef, onTrigger, ...props }),
      { initialProps: initial }
    );
    return { ...hook, onTrigger, rootRef };
  }

  it('waits for enabled, then triggers exactly once', () => {
    const { onTrigger, rerender } = setup({ enabled: false });
    triggerIntersect(true);
    expect(onTrigger).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('uses the configured prefetch distance and root', () => {
    const { rootRef } = setup({ enabled: true, prefetchDistancePx: 100 });
    expect(activeObserver().options?.rootMargin).toBe('0px 0px 100px 0px');
    expect(activeObserver().options?.root).toBe(rootRef.current);
  });
});
