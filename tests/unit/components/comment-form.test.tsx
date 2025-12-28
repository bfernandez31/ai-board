/**
 * RTL Component Tests: CommentForm
 *
 * Tests for the comment form component.
 * Verifies text input, character count, and Cmd/Ctrl+Enter submission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { CommentForm } from '@/components/comments/comment-form';

// Mock the hooks
const mockCreateComment = vi.fn();
vi.mock('@/app/lib/hooks/mutations/use-create-comment', () => ({
  useCreateComment: vi.fn(() => ({
    mutate: mockCreateComment,
    isPending: false,
  })),
}));

vi.mock('@/app/lib/hooks/queries/useProjectMembers', () => ({
  useProjectMembers: vi.fn(() => ({
    data: { members: [] },
    isLoading: false,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Import the mocked hook to control it
import { useCreateComment } from '@/app/lib/hooks/mutations/use-create-comment';
const mockUseCreateComment = vi.mocked(useCreateComment);

describe('CommentForm', () => {
  const defaultProps = {
    projectId: 1,
    ticketId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateComment.mockReturnValue({
      mutate: mockCreateComment,
      isPending: false,
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isError: false,
      isIdle: true,
      isPaused: false,
      isSuccess: false,
      status: 'idle',
      submittedAt: 0,
      variables: undefined,
    });
  });

  describe('Rendering', () => {
    it('should display textarea with placeholder', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByPlaceholderText(/write a comment/i)).toBeInTheDocument();
    });

    it('should display character count', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByText(/0 \/ 2000/i)).toBeInTheDocument();
    });

    it('should display submit button', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument();
    });

    it('should display keyboard shortcut hint', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByText(/cmd\+enter/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when textarea is empty', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /comment/i })).toBeDisabled();
    });

    it('should enable submit button when textarea has content', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/write a comment/i), 'Test comment');

      expect(screen.getByRole('button', { name: /comment/i })).not.toBeDisabled();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/write a comment/i), 'Hello');

      expect(screen.getByText(/5 \/ 2000/i)).toBeInTheDocument();
    });

    it('should show red character count when exceeding max length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      // Type more than 2000 characters
      const longText = 'A'.repeat(2001);
      await user.type(screen.getByPlaceholderText(/write a comment/i), longText);

      // The character count should be styled differently (red)
      const charCount = screen.getByText(/2001 \/ 2000/i);
      expect(charCount).toHaveClass('text-red');
    });

    it('should disable submit when content exceeds max length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      const longText = 'A'.repeat(2001);
      await user.type(screen.getByPlaceholderText(/write a comment/i), longText);

      expect(screen.getByRole('button', { name: /comment/i })).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should call createComment when submit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/write a comment/i), 'Test comment');
      await user.click(screen.getByRole('button', { name: /comment/i }));

      expect(mockCreateComment).toHaveBeenCalledWith({ content: 'Test comment' });
    });

    it('should trim whitespace before submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/write a comment/i), '  Test comment  ');
      await user.click(screen.getByRole('button', { name: /comment/i }));

      expect(mockCreateComment).toHaveBeenCalledWith({ content: 'Test comment' });
    });

    it('should not submit when content is only whitespace', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/write a comment/i), '   ');
      await user.click(screen.getByRole('button', { name: /comment/i }));

      expect(mockCreateComment).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading text when isPending is true', () => {
      mockUseCreateComment.mockReturnValue({
        mutate: mockCreateComment,
        isPending: true,
        mutateAsync: vi.fn(),
        reset: vi.fn(),
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isError: false,
        isIdle: false,
        isPaused: false,
        isSuccess: false,
        status: 'pending',
        submittedAt: 0,
        variables: undefined,
      });

      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument();
    });

    it('should disable submit button when isPending is true', () => {
      mockUseCreateComment.mockReturnValue({
        mutate: mockCreateComment,
        isPending: true,
        mutateAsync: vi.fn(),
        reset: vi.fn(),
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isError: false,
        isIdle: false,
        isPaused: false,
        isSuccess: false,
        status: 'pending',
        submittedAt: 0,
        variables: undefined,
      });

      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit on Cmd+Enter when form is valid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      await user.type(textarea, 'Test comment');

      // Simulate Cmd+Enter (Meta+Enter on Mac)
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalledWith({ content: 'Test comment' });
      });
    });

    it('should submit on Ctrl+Enter when form is valid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      await user.type(textarea, 'Test comment');

      // Simulate Ctrl+Enter
      await user.keyboard('{Control>}{Enter}{/Control}');

      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalledWith({ content: 'Test comment' });
      });
    });

    it('should not submit on Cmd+Enter when form is empty', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommentForm {...defaultProps} />);

      // Focus on textarea but don't type
      screen.getByPlaceholderText(/write a comment/i).focus();

      // Simulate Cmd+Enter
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockCreateComment).not.toHaveBeenCalled();
    });
  });
});
