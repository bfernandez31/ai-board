import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/utils/component-test-utils';
import { TicketCard, type TicketCardSelection } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(overrides: Partial<TicketWithVersion> = {}): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'Sample ticket',
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

function selectionFixture(overrides: Partial<TicketCardSelection> = {}): TicketCardSelection {
  return {
    isSelected: false,
    isSelectMode: false,
    onToggle: vi.fn(),
    onRangeSelect: vi.fn(),
    ...overrides,
  };
}

describe('TicketCard bulk selection', () => {
  it('does not render a checkbox without a selection prop', () => {
    renderWithProviders(<TicketCard ticket={makeTicket()} />);
    expect(screen.queryByTestId('bulk-select-checkbox')).toBeNull();
  });

  it('renders the checkbox hidden by default and visible in select mode', () => {
    const selection = selectionFixture({ isSelectMode: false });
    const { rerender } = renderWithProviders(
      <TicketCard ticket={makeTicket()} selection={selection} />
    );
    const wrapper = screen.getByTestId('bulk-select-checkbox').parentElement!;
    expect(wrapper.className).toContain('opacity-0');

    const inMode = selectionFixture({ isSelectMode: true, isSelected: true });
    rerender(<TicketCard ticket={makeTicket()} selection={inMode} />);
    const wrapper2 = screen.getByTestId('bulk-select-checkbox').parentElement!;
    expect(wrapper2.className).toContain('opacity-100');
  });

  it('Cmd/Ctrl+click on card body toggles selection without opening detail panel', () => {
    const onTicketClick = vi.fn();
    const selection = selectionFixture();
    renderWithProviders(
      <TicketCard
        ticket={makeTicket()}
        onTicketClick={onTicketClick}
        selection={selection}
      />
    );
    fireEvent.click(screen.getByTestId('ticket-card'), { ctrlKey: true });
    expect(selection.onToggle).toHaveBeenCalledTimes(1);
    expect(onTicketClick).not.toHaveBeenCalled();
  });

  it('Shift+click on card body calls onRangeSelect not onTicketClick', () => {
    const onTicketClick = vi.fn();
    const selection = selectionFixture();
    renderWithProviders(
      <TicketCard
        ticket={makeTicket()}
        onTicketClick={onTicketClick}
        selection={selection}
      />
    );
    fireEvent.click(screen.getByTestId('ticket-card'), { shiftKey: true });
    expect(selection.onRangeSelect).toHaveBeenCalledTimes(1);
    expect(onTicketClick).not.toHaveBeenCalled();
  });

  it('plain checkbox click toggles selection and does not open detail', () => {
    const onTicketClick = vi.fn();
    const selection = selectionFixture();
    renderWithProviders(
      <TicketCard
        ticket={makeTicket()}
        onTicketClick={onTicketClick}
        selection={selection}
      />
    );
    fireEvent.click(screen.getByTestId('bulk-select-checkbox'));
    expect(selection.onToggle).toHaveBeenCalledTimes(1);
    expect(onTicketClick).not.toHaveBeenCalled();
  });

  it('plain click on card body in select mode opens detail (toggle only via Cmd/Ctrl)', () => {
    const onTicketClick = vi.fn();
    const selection = selectionFixture({ isSelectMode: true });
    renderWithProviders(
      <TicketCard
        ticket={makeTicket()}
        onTicketClick={onTicketClick}
        selection={selection}
      />
    );
    fireEvent.click(screen.getByTestId('ticket-card'));
    expect(onTicketClick).toHaveBeenCalledTimes(1);
    expect(selection.onToggle).not.toHaveBeenCalled();
  });

  it('Cmd/Ctrl+click in select mode still does NOT open detail panel (FR-006)', () => {
    const onTicketClick = vi.fn();
    const selection = selectionFixture({ isSelectMode: true, isSelected: true });
    renderWithProviders(
      <TicketCard
        ticket={makeTicket()}
        onTicketClick={onTicketClick}
        selection={selection}
      />
    );
    fireEvent.click(screen.getByTestId('ticket-card'), { metaKey: true });
    expect(selection.onToggle).toHaveBeenCalledTimes(1);
    expect(onTicketClick).not.toHaveBeenCalled();
  });
});
