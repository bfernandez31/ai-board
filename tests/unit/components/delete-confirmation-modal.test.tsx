/**
 * RTL Component Tests: DeleteConfirmationModal
 *
 * Tests for the ticket deletion confirmation modal.
 * Verifies confirmation flow and danger action behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { DeleteConfirmationModal } from '@/components/board/delete-confirmation-modal';
import type { TicketWithVersion } from '@/lib/types';

// Mock the stage confirmation messages utility
vi.mock('@/lib/utils/stage-confirmation-messages', () => ({
  getConfirmationMessage: vi.fn().mockReturnValue('This action cannot be undone.'),
}));

describe('DeleteConfirmationModal', () => {
  const mockTicket: TicketWithVersion = {
    id: 1,
    ticketKey: 'TEST-123',
    title: 'Test Ticket',
    description: 'Test description',
    stage: 'INBOX',
    position: 0,
    projectId: 1,
    branch: null,
    workflowType: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    clarificationPolicy: null,
    previewUrl: null,
  };

  const defaultProps = {
    ticket: mockTicket,
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isDeleting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display delete confirmation title', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /delete ticket/i })).toBeInTheDocument();
    });

    it('should display the ticket key being deleted', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByText('TEST-123')).toBeInTheDocument();
    });

    it('should display stage-specific warning message', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('should not render when ticket is null', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} ticket={null} />);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirm when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /delete permanently/i }));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenChange when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Loading State', () => {
    it('should show loading text when isDeleting is true', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={true} />);

      expect(screen.getByRole('button', { name: /deleting/i })).toBeInTheDocument();
    });

    it('should disable buttons when isDeleting is true', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={true} />);

      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  describe('Danger Action Styling', () => {
    it('should have destructive styling on delete button', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: /delete permanently/i });
      expect(deleteButton).toHaveClass('bg-red-600');
    });
  });
});
