import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';
import { DndContext } from '@dnd-kit/core';

function ticket(overrides: Partial<TicketWithVersion> = {}): TicketWithVersion {
  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'AIB-1',
    title: 'A ticket',
    description: null,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    qualityScore: null,
    createdAt: '2026-05-21T00:00:00Z',
    updatedAt: '2026-05-21T00:00:00Z',
    ...overrides,
  } as TicketWithVersion;
}

function renderCard(ui: React.ReactElement) {
  return renderWithProviders(<DndContext>{ui}</DndContext>);
}

describe('TicketCard selection overlay', () => {
  it('does not render a checkbox when selectionState is omitted', () => {
    renderCard(<TicketCard ticket={ticket()} />);
    expect(screen.queryByTestId('ticket-select-checkbox')).not.toBeInTheDocument();
  });

  it('renders a checkbox when selectionState is provided', () => {
    renderCard(
      <TicketCard ticket={ticket()} selectionState={{ selected: false, onToggle: vi.fn() }} />,
    );
    expect(screen.getByTestId('ticket-select-checkbox')).toBeInTheDocument();
  });

  it('renders checked state when selectionState.selected is true', () => {
    renderCard(
      <TicketCard ticket={ticket()} selectionState={{ selected: true, onToggle: vi.fn() }} />,
    );
    const wrapper = screen.getByTestId('ticket-card');
    expect(wrapper).toHaveAttribute('data-selected', 'true');
  });

  it('invokes onToggle on click and stops propagation so the card click handler is not called', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onTicketClick = vi.fn();

    renderCard(
      <TicketCard
        ticket={ticket()}
        onTicketClick={onTicketClick}
        selectionState={{ selected: false, onToggle }}
      />,
    );

    await user.click(screen.getByTestId('ticket-select-overlay'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onTicketClick).not.toHaveBeenCalled();
  });

  it('preserves shift-click modifier when invoking onToggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderCard(
      <TicketCard
        ticket={ticket()}
        selectionState={{ selected: false, onToggle }}
      />,
    );

    await user.keyboard('{Shift>}');
    await user.click(screen.getByTestId('ticket-select-overlay'));
    await user.keyboard('{/Shift}');

    expect(onToggle).toHaveBeenCalledTimes(1);
    const event = onToggle.mock.calls[0]![0] as React.MouseEvent;
    expect(event.shiftKey).toBe(true);
  });
});
