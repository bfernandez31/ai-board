/**
 * NewTicketModal Component Tests
 *
 * Tests for the modal dialog used to create new tickets.
 * Tests form rendering, validation, and submission behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { NewTicketModal } from '@/components/board/new-ticket-modal';

// Mock the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NewTicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('rendering', () => {
    it('renders form fields for title and description when open', () => {
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('renders dialog with correct title', () => {
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Ticket')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderWithProviders(
        <NewTicketModal
          open={false}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders clarification policy dropdown', () => {
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      expect(
        screen.getByLabelText('Clarification Policy (Optional)')
      ).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('validates required title field on blur', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      const titleInput = screen.getByLabelText('Title');
      await user.click(titleInput);
      await user.tab(); // Blur the input

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });

    it('shows character count for title', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Hello');

      expect(screen.getByText('5/100 characters')).toBeInTheDocument();
    });

    it('shows character count for description', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      const descriptionInput = screen.getByLabelText('Description');
      await user.type(descriptionInput, 'Test description');

      expect(screen.getByText('16/2500 characters')).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with form data when submitted', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onTicketCreated = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={onOpenChange}
          onTicketCreated={onTicketCreated}
          projectId={1}
        />
      );

      const titleInput = screen.getByLabelText('Title');
      const descriptionInput = screen.getByLabelText('Description');

      await user.type(titleInput, 'New Test Ticket');
      await user.type(descriptionInput, 'This is a test description');
      await user.click(screen.getByRole('button', { name: /create ticket/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/1/tickets',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('disables submit button when form is invalid', async () => {
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      // Form is empty, so submit should be disabled
      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when title and description are provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={vi.fn()}
          projectId={1}
        />
      );

      const titleInput = screen.getByLabelText('Title');
      const descriptionInput = screen.getByLabelText('Description');
      await user.type(titleInput, 'Valid Title');
      await user.type(descriptionInput, 'Valid description');

      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('cancel behavior', () => {
    it('closes modal on cancel button click', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      renderWithProviders(
        <NewTicketModal
          open={true}
          onOpenChange={onOpenChange}
          projectId={1}
        />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
