import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { BulkActionBar } from '@/components/board/bulk-action-bar';

function setup(count: number) {
  const handlers = {
    onChangeAgent: vi.fn(),
    onChangeModel: vi.fn(),
    onFusion: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  };
  renderWithProviders(<BulkActionBar selectionCount={count} {...handlers} />);
  return handlers;
}

describe('BulkActionBar', () => {
  it('renders nothing when no tickets are selected', () => {
    setup(0);
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  it('renders the selection count when at least one ticket is selected', () => {
    setup(1);
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-selection-count')).toHaveTextContent('1 selected');
  });

  it('enables Delete + Change buttons when 1 ticket is selected', () => {
    setup(1);
    expect(screen.getByTestId('bulk-delete')).toBeEnabled();
    expect(screen.getByTestId('bulk-change-agent')).toBeEnabled();
    expect(screen.getByTestId('bulk-change-model')).toBeEnabled();
  });

  it('disables Fusion when fewer than 2 tickets are selected', () => {
    setup(1);
    expect(screen.getByTestId('bulk-fusion')).toBeDisabled();
  });

  it('enables Fusion at 2+ tickets', () => {
    setup(3);
    expect(screen.getByTestId('bulk-fusion')).toBeEnabled();
  });

  it('disables every action button when selection exceeds 50 and shows a hint', () => {
    setup(51);
    expect(screen.getByTestId('bulk-delete')).toBeDisabled();
    expect(screen.getByTestId('bulk-change-agent')).toBeDisabled();
    expect(screen.getByTestId('bulk-change-model')).toBeDisabled();
    expect(screen.getByTestId('bulk-fusion')).toBeDisabled();
    expect(screen.getByTestId('bulk-selection-too-large')).toBeInTheDocument();
  });

  it('clears selection when Clear is clicked', async () => {
    const user = userEvent.setup();
    const handlers = setup(3);
    await user.click(screen.getByTestId('bulk-clear-selection'));
    expect(handlers.onClear).toHaveBeenCalledTimes(1);
  });
});
