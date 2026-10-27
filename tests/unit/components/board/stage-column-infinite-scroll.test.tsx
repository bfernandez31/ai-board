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

import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { StageColumn } from '@/components/board/stage-column';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/lib/types';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const observers: Array<{ callback: ObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = [];

class MockIntersectionObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  constructor(callback: ObserverCallback) {
    observers.push({ callback, disconnect: this.disconnect });
  }
}

function makeTicket(id: number): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title: `[e2e] Ship ${id}`,
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

function renderShip(props: Partial<React.ComponentProps<typeof StageColumn>> = {}, count = 2) {
  const tickets = Array.from({ length: count }, (_, i) => makeTicket(i + 1));
  return renderWithProviders(
    <DndContext>
      <StageColumn stage={Stage.SHIP} tickets={tickets} projectId={1} {...props} />
    </DndContext>
  );
}

function latestObserver() {
  const observer = observers[observers.length - 1];
  if (!observer) throw new Error('No IntersectionObserver created');
  return observer;
}

describe('StageColumn SHIP infinite scroll', () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render a Load more button', () => {
    renderShip({ onLoadMore: vi.fn(), totalCount: 10 });
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('renders the sentinel when onLoadMore is set', () => {
    renderShip({ onLoadMore: vi.fn(), totalCount: 10 });
    expect(screen.getByTestId('ship-load-sentinel')).toBeDefined();
  });

  it('calls onLoadMore when the sentinel intersects', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore, totalCount: 10 });
    act(() => latestObserver().callback([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not call onLoadMore when the sentinel is not intersecting', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore, totalCount: 10 });
    act(() => latestObserver().callback([{ isIntersecting: false }]));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('shows a loading status and does not call onLoadMore while loading', () => {
    const onLoadMore = vi.fn();
    renderShip({ onLoadMore, isLoadingMore: true, totalCount: 10 });
    expect(screen.getByRole('status', { name: 'Loading more tickets' })).toBeDefined();
    act(() => latestObserver().callback([{ isIntersecting: true }]));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('renders no sentinel or observer when onLoadMore is undefined', () => {
    renderShip({ totalCount: 2 });
    expect(screen.queryByTestId('ship-load-sentinel')).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it('shows loaded/total counter when more tickets remain and plain count otherwise', () => {
    const { unmount } = renderShip({ onLoadMore: vi.fn(), totalCount: 10 });
    expect(screen.getByText('2/10')).toBeDefined();
    unmount();
    renderShip({ totalCount: 2 });
    expect(screen.queryByText('2/2')).toBeNull();
  });

  it('shows error row with Retry, no sentinel, and no automatic load', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    renderShip({ onLoadMore, loadMoreError: true, totalCount: 10 });

    expect(screen.getByRole('alert').textContent).toContain("Couldn't load more tickets");
    expect(screen.queryByTestId('ship-load-sentinel')).toBeNull();
    expect(onLoadMore).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('re-creates the observer after the ticket count changes', () => {
    const onLoadMore = vi.fn();
    const tickets = [makeTicket(1), makeTicket(2)];
    const ui = (list: TicketWithVersion[]) => (
      <DndContext>
        <StageColumn stage={Stage.SHIP} tickets={list} projectId={1} onLoadMore={onLoadMore} totalCount={10} />
      </DndContext>
    );
    const { rerender } = renderWithProviders(ui(tickets));
    const first = latestObserver();
    act(() => first.callback([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(ui([...tickets, makeTicket(3)]));
    expect(first.disconnect).toHaveBeenCalled();
    const second = latestObserver();
    expect(second).not.toBe(first);
    act(() => second.callback([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });
});
