/**
 * RTL Component Tests: CancelJobDialog
 *
 * Tests for the cancel job confirmation dialog.
 * Verifies display, confirm/cancel behavior, and loading state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { CancelJobDialog } from '@/components/board/cancel-job-dialog';

describe('CancelJobDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    command: 'specify',
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display dialog with command name when open', () => {
      renderWithProviders(<CancelJobDialog {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/specify/)).toBeInTheDocument();
    });

    it('should show confirm and cancel buttons', () => {
      renderWithProviders(<CancelJobDialog {...defaultProps} />);

      expect(screen.getByText('Non')).toBeInTheDocument();
      expect(screen.getByText('Oui, annuler')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CancelJobDialog {...defaultProps} />);

      await user.click(screen.getByTestId('cancel-job-confirm'));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenChange(false) when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CancelJobDialog {...defaultProps} />);

      await user.click(screen.getByText('Non'));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Loading State', () => {
    it('should disable buttons when isPending is true', () => {
      renderWithProviders(<CancelJobDialog {...defaultProps} isPending={true} />);

      expect(screen.getByText('Non')).toBeDisabled();
      expect(screen.getByText('Annulation...')).toBeDisabled();
    });

    it('should show loading text when isPending', () => {
      renderWithProviders(<CancelJobDialog {...defaultProps} isPending={true} />);

      expect(screen.getByText('Annulation...')).toBeInTheDocument();
    });
  });
});
