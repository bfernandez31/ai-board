/**
 * NewTicketModal Component Integration Tests
 *
 * Tests form validation, submission, and modal behavior using
 * React Testing Library with the renderWithProviders utility.
 *
 * @see specs/AIB-117-testing-trophy-component/contracts/component-test-patterns.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/helpers/render-with-providers';
import { NewTicketModal } from '@/components/board/new-ticket-modal';
import { mockResponses } from '@/tests/fixtures/component-mocks';

describe('NewTicketModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onTicketCreated: vi.fn(),
    projectId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('form validation', () => {
    it('should show validation error for empty title on submit', async () => {
      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      // Try to submit without entering a title
      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      await user.click(submitButton);

      // The button should be disabled when form is invalid
      expect(submitButton).toBeDisabled();
    });

    it('should show validation error for short title', async () => {
      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'ab');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        const errorMessage = screen.getByText(/must be at least 3 characters/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should show validation error for long description', async () => {
      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const descriptionInput = screen.getByLabelText(/description/i);
      const longText = 'a'.repeat(2501);

      // Type a very long description
      await user.type(descriptionInput, longText);
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        const errorMessage = screen.getByText(/must be at most 2500 characters/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('should enable submit button when form is valid', async () => {
      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, '[e2e] Valid Title');

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /create ticket/i });
        expect(submitButton).toBeEnabled();
      });
    });
  });

  describe('form submission', () => {
    it('should submit valid form data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponses.ticketCreated('TEST-1'),
      });
      global.fetch = mockFetch;

      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, '[e2e] Test Ticket');

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, 'Test description');

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/1/tickets',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      await waitFor(() => {
        expect(defaultProps.onTicketCreated).toHaveBeenCalled();
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should show loading state during submission', async () => {
      // Create a fetch that takes a moment to resolve
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 201,
              json: async () => mockResponses.ticketCreated('TEST-1'),
            });
          }, 100);
        })
      );
      global.fetch = mockFetch;

      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, '[e2e] Test Ticket');

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      await user.click(submitButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/creating\.\.\./i)).toBeInTheDocument();
      });
    });

    it('should show error message on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });
      global.fetch = mockFetch;

      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, '[e2e] Test Ticket');

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/unable to create ticket/i)).toBeInTheDocument();
      });
    });

    it('should show field-specific error on validation failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => mockResponses.validationError('title', 'Title already exists'),
      });
      global.fetch = mockFetch;

      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, '[e2e] Duplicate Title');

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('modal behavior', () => {
    it('should render when open is true', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} open={true} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create new ticket/i)).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      renderWithProviders(<NewTicketModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call onOpenChange when cancel button is clicked', async () => {
      const { user } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should reset form when modal closes and reopens', async () => {
      const { user, rerender } = renderWithProviders(<NewTicketModal {...defaultProps} />);

      // Fill in form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Some title');

      // Close modal
      rerender(<NewTicketModal {...defaultProps} open={false} />);

      // Reopen modal
      rerender(<NewTicketModal {...defaultProps} open={true} />);

      // Form should be reset
      const newTitleInput = screen.getByLabelText(/title/i);
      expect(newTitleInput).toHaveValue('');
    });
  });
});
