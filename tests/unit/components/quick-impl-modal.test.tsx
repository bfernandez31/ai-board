/**
 * RTL Component Tests: QuickImplModal
 *
 * Tests for the quick implementation confirmation modal.
 * Verifies confirm/cancel behavior and keyboard accessibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
import { QuickImplModal } from '@/components/board/quick-impl-modal';

describe('QuickImplModal', () => {
  const defaultProps = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display modal title and description when open', () => {
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /quick implementation/i })).toBeInTheDocument();
      expect(screen.getByText(/skip the specification and planning phases/i)).toBeInTheDocument();
    });

    it('should display benefits and trade-offs sections', () => {
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      expect(screen.getByText(/benefits/i)).toBeInTheDocument();
      expect(screen.getByText(/trade-offs/i)).toBeInTheDocument();
      expect(screen.getByText(/faster implementation/i)).toBeInTheDocument();
      expect(screen.getByText(/no formal specification/i)).toBeInTheDocument();
    });

    it('should display warning message about complex features', () => {
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      expect(screen.getByText(/complex features or architectural changes/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirm when proceed button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /proceed with quick implementation/i }));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when dialog is closed via overlay', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      // Find close button (X) in dialog
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should have focusable buttons for keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuickImplModal {...defaultProps} />);

      // Tab through the modal buttons
      await user.tab();

      // One of the buttons should be focused
      const focusedElement = document.activeElement;
      expect(focusedElement?.tagName).toBe('BUTTON');
    });
  });
});
