/**
 * DeleteConfirmationModal Component Integration Tests
 *
 * Tests modal visibility, confirmation callbacks, and loading states.
 *
 * @see specs/AIB-117-testing-trophy-component/contracts/component-test-patterns.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/helpers/render-with-providers';
import { DeleteConfirmationModal, type DeleteConfirmationModalProps } from '@/components/board/delete-confirmation-modal';
import type { TicketWithVersion } from '@/lib/types';

// Mock the utility function
vi.mock('@/lib/utils/stage-confirmation-messages', () => ({
  getConfirmationMessage: vi.fn(() => 'This action cannot be undone.'),
}));

describe('DeleteConfirmationModal', () => {
  const mockTicket: TicketWithVersion = {
    id: 1,
    ticketKey: 'TEST-1',
    title: '[e2e] Test Ticket',
    description: 'Test description',
    stage: 'INBOX',
    projectId: 1,
    branch: null,
    previewUrl: null,
    workflowType: 'FULL',
    clarificationPolicy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };

  const defaultProps: DeleteConfirmationModalProps = {
    ticket: mockTicket,
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isDeleting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('should render when open is true', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} open={true} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/delete ticket/i)).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should not render when ticket is null', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} ticket={null} />);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should display ticket key in description', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByText('TEST-1')).toBeInTheDocument();
    });

    it('should show confirmation message', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('should call onConfirm when delete button is clicked', async () => {
      const onConfirm = vi.fn();
      const { user } = renderWithProviders(
        <DeleteConfirmationModal {...defaultProps} onConfirm={onConfirm} />
      );

      const deleteButton = screen.getByRole('button', { name: /delete permanently/i });
      await user.click(deleteButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenChange when cancel button is clicked', async () => {
      const onOpenChange = vi.fn();
      const { user } = renderWithProviders(
        <DeleteConfirmationModal {...defaultProps} onOpenChange={onOpenChange} />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not close modal automatically on confirm click', async () => {
      const onOpenChange = vi.fn();
      const onConfirm = vi.fn();
      const { user } = renderWithProviders(
        <DeleteConfirmationModal
          {...defaultProps}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete permanently/i });
      await user.click(deleteButton);

      // onOpenChange should NOT be called automatically
      // (the parent component controls this after the async operation completes)
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading text when isDeleting is true', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={true} />);

      expect(screen.getByText(/deleting\.\.\./i)).toBeInTheDocument();
    });

    it('should disable delete button when isDeleting is true', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={true} />);

      const deleteButton = screen.getByRole('button', { name: /deleting/i });
      expect(deleteButton).toBeDisabled();
    });

    it('should disable cancel button when isDeleting is true', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={true} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('should not call onConfirm when delete button is clicked during loading', async () => {
      const onConfirm = vi.fn();
      const { user } = renderWithProviders(
        <DeleteConfirmationModal {...defaultProps} onConfirm={onConfirm} isDeleting={true} />
      );

      const deleteButton = screen.getByRole('button', { name: /deleting/i });

      // Button is disabled, clicking should not trigger onConfirm
      await user.click(deleteButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('button states', () => {
    it('should show "Delete Permanently" text when not loading', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={false} />);

      expect(screen.getByRole('button', { name: /delete permanently/i })).toBeInTheDocument();
    });

    it('should enable both buttons when not loading', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} isDeleting={false} />);

      expect(screen.getByRole('button', { name: /delete permanently/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
    });
  });

  describe('accessibility', () => {
    it('should have alertdialog role', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should have descriptive title', () => {
      renderWithProviders(<DeleteConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/delete ticket/i)).toBeInTheDocument();
    });
  });
});
