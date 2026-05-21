import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { BulkDeleteConfirmationModal } from '@/components/board/bulk-delete-confirmation-modal';

describe('BulkDeleteConfirmationModal', () => {
  const baseProps = {
    open: true,
    ticketKeys: ['AIB-101', 'AIB-102', 'AIB-103'],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isPending: false,
  };

  beforeEach(() => vi.clearAllMocks());

  it('lists every supplied ticket key', () => {
    renderWithProviders(<BulkDeleteConfirmationModal {...baseProps} />);
    for (const key of baseProps.ticketKeys) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('shows the irreversible warning', () => {
    renderWithProviders(<BulkDeleteConfirmationModal {...baseProps} />);
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
  });

  it('fires onConfirm when the Delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkDeleteConfirmationModal {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /delete \d+ ticket/i }));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when the Cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkDeleteConfirmationModal {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables the confirm button while pending', () => {
    renderWithProviders(<BulkDeleteConfirmationModal {...baseProps} isPending />);
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
  });

  it('handles a single-ticket selection grammatically', () => {
    renderWithProviders(
      <BulkDeleteConfirmationModal {...baseProps} ticketKeys={['AIB-101']} />,
    );
    expect(screen.getByRole('heading', { name: /delete 1 ticket\?/i })).toBeInTheDocument();
  });
});
