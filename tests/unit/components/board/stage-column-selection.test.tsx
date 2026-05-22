import { describe, it, expect, vi } from 'vitest';

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
import { DndContext } from '@dnd-kit/core';
import { StageColumn, type BulkSelectionContext } from '@/components/board/stage-column';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(overrides: Partial<TicketWithVersion>): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Sample',
    description: 'desc',
    stage: 'INBOX',
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

function makeSelection(overrides: Partial<BulkSelectionContext> = {}): BulkSelectionContext {
  return {
    selectedIds: new Set<number>(),
    isSelectMode: false,
    toggle: vi.fn(),
    rangeSelectTo: vi.fn(),
    ...overrides,
  };
}

describe('StageColumn bulk selection threading', () => {
  it('renders selection checkboxes for INBOX tickets', () => {
    const tickets = [
      makeTicket({ id: 1, ticketNumber: 1, ticketKey: 'AIB-1', stage: 'INBOX' }),
      makeTicket({ id: 2, ticketNumber: 2, ticketKey: 'AIB-2', stage: 'INBOX' }),
    ];
    renderWithProviders(
      <DndContext>
        <StageColumn
          stage={Stage.INBOX}
          tickets={tickets}
          projectId={1}
          bulkSelection={makeSelection({ isSelectMode: true })}
        />
      </DndContext>
    );
    expect(screen.getAllByTestId('bulk-select-checkbox')).toHaveLength(2);
  });

  it('does NOT render selection checkboxes when stage is not INBOX', () => {
    const tickets = [
      makeTicket({ id: 1, ticketNumber: 1, ticketKey: 'AIB-1', stage: 'SPECIFY' }),
    ];
    renderWithProviders(
      <DndContext>
        <StageColumn
          stage={Stage.SPECIFY}
          tickets={tickets}
          projectId={1}
          bulkSelection={makeSelection({ isSelectMode: true })}
        />
      </DndContext>
    );
    expect(screen.queryByTestId('bulk-select-checkbox')).toBeNull();
  });
});
