/**
 * NewTicketModal Component Tests
 *
 * Tests for Zod form validation, field error display, and form submission handling.
 * Uses React Testing Library patterns following Testing Trophy strategy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { NewTicketModal } from '@/components/board/new-ticket-modal';

describe('NewTicketModal', () => {
  let queryClient: QueryClient;
  const mockOnOpenChange = vi.fn();
  const mockOnTicketCreated = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    global.fetch = vi.fn();
    mockOnOpenChange.mockClear();
    mockOnTicketCreated.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (open = true) => {
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(NewTicketModal, {
          open,
          onOpenChange: mockOnOpenChange,
          onTicketCreated: mockOnTicketCreated,
          projectId: 1,
        })
      )
    );
  };

  describe('Form Validation', () => {
    it('should render the modal with form fields', () => {
      renderComponent();

      expect(screen.getByText('Create New Ticket')).toBeDefined();
      expect(screen.getByLabelText(/title/i)).toBeDefined();
      expect(screen.getByLabelText(/description/i)).toBeDefined();
    });

    it('should show title character count', () => {
      renderComponent();

      expect(screen.getByText('0/100 characters')).toBeDefined();
    });

    it('should show description character count', () => {
      renderComponent();

      expect(screen.getByText('0/2500 characters')).toBeDefined();
    });

    it('should update character counts as user types', async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'Hello' } });

      await waitFor(() => {
        expect(screen.getByText('5/100 characters')).toBeDefined();
      });
    });

    it('should disable submit button when form is invalid', () => {
      renderComponent();

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('should enable submit button when form has valid title and description', async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
      fireEvent.change(descriptionInput, { target: { value: 'Valid description content' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /create ticket/i });
        expect((submitButton as HTMLButtonElement).disabled).toBe(false);
      });
    });
  });

  describe('Field Error Display', () => {
    it('should show error when title exceeds 100 characters', async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const longTitle = 'a'.repeat(101);

      fireEvent.change(titleInput, { target: { value: longTitle } });
      fireEvent.blur(titleInput);

      await waitFor(() => {
        expect(screen.getByText(/title must be 100 characters or less/i)).toBeDefined();
      });
    });

    it('should show error when title is empty after blur', async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);

      fireEvent.blur(titleInput);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeDefined();
      });
    });

    it('should show error when description exceeds 2500 characters', async () => {
      renderComponent();

      const descriptionInput = screen.getByLabelText(/description/i);
      const longDescription = 'a'.repeat(2501);

      fireEvent.change(descriptionInput, { target: { value: longDescription } });
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(screen.getByText(/description must be 2500 characters or less/i)).toBeDefined();
      });
    });

    it('should clear error when valid input is provided', async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);

      // First trigger error
      fireEvent.blur(titleInput);
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeDefined();
      });

      // Then provide valid input
      fireEvent.change(titleInput, { target: { value: 'Valid title' } });

      await waitFor(() => {
        expect(screen.queryByText(/title is required/i)).toBeNull();
      });
    });

    it('should apply error styling to invalid fields', async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);

      fireEvent.blur(titleInput);

      await waitFor(() => {
        expect((titleInput as HTMLInputElement).className).toContain('border-red-500');
      });
    });
  });

  describe('Form Submission Handling', () => {
    it('should submit form with valid data', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ticket: { id: 1 } }),
      } as Response);

      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Test Ticket' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/projects/1/tickets',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      let resolveSubmit: (value: Response) => void;
      const submitPromise = new Promise<Response>((resolve) => {
        resolveSubmit = resolve;
      });

      vi.mocked(global.fetch).mockReturnValue(submitPromise);

      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Test Ticket' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeDefined();
      });

      // Resolve the promise to clean up
      resolveSubmit!({
        ok: true,
        json: async () => ({ ticket: { id: 1 } }),
      } as Response);
    });

    it('should close modal and call onTicketCreated on success', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ticket: { id: 1 } }),
      } as Response);

      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Test Ticket' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
        expect(mockOnTicketCreated).toHaveBeenCalled();
      });
    });

    it('should display API validation errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation failed',
          details: {
            fieldErrors: {
              title: ['Title already exists'],
            },
          },
        }),
      } as Response);

      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Duplicate Title' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title already exists')).toBeDefined();
      });
    });

    it('should display generic error for non-400 responses', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      } as Response);

      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Test Ticket' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/unable to create ticket/i)).toBeDefined();
      });
    });

    it('should display network error message', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(titleInput, { target: { value: 'Test Ticket' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeDefined();
      });
    });
  });

  describe('Modal Behavior', () => {
    it('should not render content when closed', () => {
      renderComponent(false);

      expect(screen.queryByText('Create New Ticket')).toBeNull();
    });

    it('should reset form when modal closes', async () => {
      const { rerender } = renderComponent();

      // Fill in the form
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'Test Title' } });

      // Close the modal
      rerender(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(NewTicketModal, {
            open: false,
            onOpenChange: mockOnOpenChange,
            onTicketCreated: mockOnTicketCreated,
            projectId: 1,
          })
        )
      );

      // Reopen the modal
      rerender(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(NewTicketModal, {
            open: true,
            onOpenChange: mockOnOpenChange,
            onTicketCreated: mockOnTicketCreated,
            projectId: 1,
          })
        )
      );

      // Form should be reset
      await waitFor(() => {
        const newTitleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
        expect(newTitleInput.value).toBe('');
      });
    });

    it('should call onOpenChange when cancel button is clicked', () => {
      renderComponent();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
