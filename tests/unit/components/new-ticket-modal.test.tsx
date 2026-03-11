/**
 * RTL Component Tests: NewTicketModal
 *
 * Tests for the new ticket creation modal.
 * Verifies form submission, validation, and keyboard accessibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { NewTicketModal } from '@/components/board/new-ticket-modal';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useUsage hook
const mockUseUsage = vi.fn();
vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => mockUseUsage(),
  usageKeys: { all: ['usage'] as const, current: () => ['usage', 'current'] as const },
}));

describe('NewTicketModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onTicketCreated: vi.fn(),
    projectId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Default: no usage data (no quota display)
    mockUseUsage.mockReturnValue({ data: undefined });
  });

  describe('Rendering', () => {
    it('should display modal title and description when open', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /create new ticket/i })).toBeInTheDocument();
      expect(screen.getByText(/create a new ticket with a title/i)).toBeInTheDocument();
    });

    it('should display title and description input fields', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should display character count for title field', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByText(/0\/100 characters/i)).toBeInTheDocument();
    });

    it('should display character count for description field', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByText(/0\/10000 characters/i)).toBeInTheDocument();
    });

    it('should display create and cancel buttons', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when form is empty', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /create ticket/i })).toBeDisabled();
    });

    it('should enable submit button when title and description are valid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/title/i), 'Test Ticket Title');
      await user.type(screen.getByLabelText(/description/i), 'Test description for the ticket');

      expect(screen.getByRole('button', { name: /create ticket/i })).not.toBeDisabled();
    });

    it('should show validation error for title exceeding max length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      // Type more than 100 characters
      const longTitle = 'A'.repeat(101);
      await user.type(screen.getByLabelText(/title/i), longTitle);

      // Trigger blur to show validation
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/101\/100 characters/i)).toBeInTheDocument();
      });
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/title/i), 'Hello');

      expect(screen.getByText(/5\/100 characters/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call API and onTicketCreated on successful submission', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, ticketKey: 'TEST-1' }),
      });

      renderWithProviders(<NewTicketModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/title/i), 'Test Ticket');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /create ticket/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/1/tickets',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      await waitFor(() => {
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
        expect(defaultProps.onTicketCreated).toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(pendingPromise);

      renderWithProviders(<NewTicketModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/title/i), 'Test Ticket');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /create ticket/i }));

      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();

      // Cleanup
      resolvePromise!({ ok: true, json: async () => ({}) });
    });

    it('should display error message on API failure', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      renderWithProviders(<NewTicketModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/title/i), 'Test Ticket');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /create ticket/i }));

      await waitFor(() => {
        expect(screen.getByText(/unable to create ticket/i)).toBeInTheDocument();
      });
    });
  });

  describe('Modal Close Behavior', () => {
    it('should call onOpenChange when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onOpenChange when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should focus title input on modal open (autoFocus)', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toHaveFocus();
    });
  });

  describe('Ticket Quota Display', () => {
    it('should show ticket count for Free plan user', () => {
      mockUseUsage.mockReturnValue({
        data: {
          plan: 'FREE',
          planName: 'Free',
          projects: { current: 1, max: 1 },
          ticketsThisMonth: { current: 3, max: 5, resetDate: '2026-04-01T00:00:00.000Z' },
          status: 'none',
          gracePeriodEndsAt: null,
        },
      });

      renderWithProviders(<NewTicketModal {...defaultProps} />);
      expect(screen.getByText(/3\/5 tickets used this month/)).toBeInTheDocument();
    });

    it('should show upgrade prompt when ticket limit is reached', () => {
      mockUseUsage.mockReturnValue({
        data: {
          plan: 'FREE',
          planName: 'Free',
          projects: { current: 1, max: 1 },
          ticketsThisMonth: { current: 5, max: 5, resetDate: '2026-04-01T00:00:00.000Z' },
          status: 'none',
          gracePeriodEndsAt: null,
        },
      });

      renderWithProviders(<NewTicketModal {...defaultProps} />);
      expect(screen.getByText(/Ticket limit reached/)).toBeInTheDocument();
      expect(screen.getByText(/Upgrade Plan/)).toBeInTheDocument();
      // Form should not be shown
      expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    });

    it('should not show ticket count for Pro plan user', () => {
      mockUseUsage.mockReturnValue({
        data: {
          plan: 'PRO',
          planName: 'Pro',
          projects: { current: 2, max: null },
          ticketsThisMonth: { current: 10, max: null, resetDate: '2026-04-01T00:00:00.000Z' },
          status: 'active',
          gracePeriodEndsAt: null,
        },
      });

      renderWithProviders(<NewTicketModal {...defaultProps} />);
      expect(screen.queryByText(/tickets used this month/)).not.toBeInTheDocument();
      // Form should still be shown
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
  });
});
