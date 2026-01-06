/**
 * RTL Component Tests: CloseConfirmationModal
 *
 * Tests for the close ticket confirmation modal.
 * Verifies confirm/cancel behavior, loading state, and content display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { CloseConfirmationModal } from '@/components/board/close-confirmation-modal';

describe('CloseConfirmationModal', () => {
  const defaultProps = {
    ticketKey: 'AIB-148',
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isClosing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display modal with ticket key when open', () => {
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /close ticket aib-148/i })).toBeInTheDocument();
    });

    it('should display warning about PR closure', () => {
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/github pr\(s\) will be closed/i)).toBeInTheDocument();
    });

    it('should display info about branch preservation', () => {
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/git branch will be preserved/i)).toBeInTheDocument();
    });

    it('should display info about board removal and searchability', () => {
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/removed from the board but remains searchable/i)).toBeInTheDocument();
    });

    it('should not render when ticketKey is null', () => {
      renderWithProviders(
        <CloseConfirmationModal {...defaultProps} ticketKey={null} />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirm when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      await user.click(screen.getByTestId('close-confirm-button'));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenChange when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Loading State', () => {
    it('should show "Closing..." text when isClosing is true', () => {
      renderWithProviders(
        <CloseConfirmationModal {...defaultProps} isClosing={true} />
      );

      expect(screen.getByText(/closing\.\.\./i)).toBeInTheDocument();
    });

    it('should disable buttons when isClosing is true', () => {
      renderWithProviders(
        <CloseConfirmationModal {...defaultProps} isClosing={true} />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
      expect(screen.getByTestId('close-confirm-button')).toBeDisabled();
    });

    it('should show "Close Ticket" text when not closing', () => {
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/close ticket$/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should have focusable buttons for keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CloseConfirmationModal {...defaultProps} />);

      // Tab through the modal buttons
      await user.tab();

      // One of the buttons should be focused
      const focusedElement = document.activeElement;
      expect(focusedElement?.tagName).toBe('BUTTON');
    });
  });
});
