/**
 * CommentForm Component Tests
 *
 * Tests for the CommentForm component which handles comment submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { CommentForm } from '@/components/comments/comment-form';

// Mock the hooks
const mockCreateComment = vi.fn();
vi.mock('@/app/lib/hooks/mutations/use-create-comment', () => ({
  useCreateComment: ({ onSuccess }: { onSuccess?: () => void }) => ({
    mutate: (data: { content: string }) => {
      mockCreateComment(data);
      onSuccess?.();
    },
    isPending: false,
  }),
}));

vi.mock('@/app/lib/hooks/queries/useProjectMembers', () => ({
  useProjectMembers: () => ({
    data: { members: [] },
    isLoading: false,
  }),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('CommentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders textarea for comment input', () => {
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      expect(
        screen.getByPlaceholderText(/write a comment/i)
      ).toBeInTheDocument();
    });

    it('renders submit button', () => {
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument();
    });

    it('shows character count', () => {
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      expect(screen.getByText('0 / 2000')).toBeInTheDocument();
    });

    it('shows keyboard shortcut hint', () => {
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      expect(screen.getByText(/cmd\+enter/i)).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('disables submit button when input is empty', () => {
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when content is entered', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      await user.type(textarea, 'Test comment');

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('updates character count as user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      await user.type(textarea, 'Hello');

      expect(screen.getByText('5 / 2000')).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls onSubmit with comment content when form is submitted', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      await user.type(textarea, 'This is my test comment');
      await user.click(screen.getByRole('button', { name: /comment/i }));

      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalledWith({
          content: 'This is my test comment',
        });
      });
    });

    it('clears input after successful submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CommentForm projectId={1} ticketId={1} />
      );

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      await user.type(textarea, 'Test comment to clear');
      await user.click(screen.getByRole('button', { name: /comment/i }));

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });
});
