/**
 * CommentForm Component Integration Tests
 *
 * Tests form input, keyboard shortcuts, and mutation handling using
 * React Testing Library with the renderWithProviders utility.
 *
 * @see specs/AIB-117-testing-trophy-component/contracts/component-test-patterns.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/helpers/render-with-providers';
import { CommentForm } from '@/components/comments/comment-form';
import { mockResponses, mockProjectMembers } from '@/tests/fixtures/component-mocks';

// Mock the hooks
vi.mock('@/app/lib/hooks/mutations/use-create-comment', () => ({
  useCreateComment: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/app/lib/hooks/queries/useProjectMembers', () => ({
  useProjectMembers: vi.fn(() => ({
    data: { members: mockProjectMembers },
    isLoading: false,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Import the mocked module to access the mock functions
import { useCreateComment } from '@/app/lib/hooks/mutations/use-create-comment';

describe('CommentForm', () => {
  const defaultProps = {
    projectId: 1,
    ticketId: 1,
  };

  let mockMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate = vi.fn();
    vi.mocked(useCreateComment).mockReturnValue({
      mutate: mockMutate,
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
      variables: undefined,
      submittedAt: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('text input', () => {
    it('should render textarea with placeholder', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/write a comment/i);
      expect(textarea).toBeInTheDocument();
    });

    it('should update value when typing', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test comment');

      expect(textarea).toHaveValue('Test comment');
    });

    it('should show character count', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test');

      expect(screen.getByText(/4 \/ 2000/)).toBeInTheDocument();
    });

    it('should disable submit button when empty', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button with valid content', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Valid comment');

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect(submitButton).toBeEnabled();
    });
  });

  describe('form submission', () => {
    it('should call mutate on submit button click', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test comment');

      const submitButton = screen.getByRole('button', { name: /comment/i });
      await user.click(submitButton);

      expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
    });

    it('should trim whitespace before submitting', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '  Test comment  ');

      const submitButton = screen.getByRole('button', { name: /comment/i });
      await user.click(submitButton);

      expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
    });
  });

  describe('keyboard shortcuts', () => {
    it('should show keyboard shortcut hint', () => {
      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByText(/cmd\+enter/i)).toBeInTheDocument();
    });

    it('should submit on Cmd+Enter', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test comment');

      // Simulate Cmd+Enter
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
    });

    it('should submit on Ctrl+Enter', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test comment');

      // Simulate Ctrl+Enter
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
    });

    it('should not submit on Cmd+Enter when content is empty', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      // Focus textarea but don't type anything
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);

      // Simulate Cmd+Enter
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading state when isPending', () => {
      vi.mocked(useCreateComment).mockReturnValue({
        mutate: mockMutate,
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
        variables: undefined,
        submittedAt: Date.now(),
      });

      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByText(/submitting\.\.\./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    });

    it('should disable textarea when isPending', () => {
      vi.mocked(useCreateComment).mockReturnValue({
        mutate: mockMutate,
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
        variables: undefined,
        submittedAt: Date.now(),
      });

      renderWithProviders(<CommentForm {...defaultProps} />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('character limit', () => {
    it('should show warning color when exceeding limit', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      const longText = 'a'.repeat(2001);

      // Type more than 2000 characters
      await user.type(textarea, longText);

      // Check that the character count shows the overflow
      const countText = screen.getByText(/2001 \/ 2000/);
      expect(countText).toBeInTheDocument();
    });

    it('should disable submit when over character limit', async () => {
      const { user } = renderWithProviders(<CommentForm {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      const longText = 'a'.repeat(2001);

      await user.type(textarea, longText);

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect(submitButton).toBeDisabled();
    });
  });
});
