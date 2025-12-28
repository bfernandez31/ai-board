/**
 * CommentForm Component Tests
 *
 * Tests for keyboard shortcuts, character limit validation, and loading/error states.
 * Uses React Testing Library patterns following Testing Trophy strategy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { CommentForm } from '@/components/comments/comment-form';

// Mock the hooks
vi.mock('@/app/lib/hooks/mutations/use-create-comment', () => ({
  useCreateComment: vi.fn(() => ({
    mutate: vi.fn(),
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

// Import mocked modules to control return values
import { useCreateComment } from '@/app/lib/hooks/mutations/use-create-comment';
import { useProjectMembers } from '@/app/lib/hooks/queries/useProjectMembers';

describe('CommentForm', () => {
  let queryClient: QueryClient;
  const mockMutate = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    // Reset mock implementations
    vi.mocked(useCreateComment).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      isIdle: true,
      data: undefined,
      error: null,
      variables: undefined,
      context: undefined,
      reset: vi.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
    });

    vi.mocked(useProjectMembers).mockReturnValue({
      data: { members: [] },
      isLoading: false,
      error: null,
      status: 'success',
      isSuccess: true,
      isFetching: false,
      isPending: false,
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isStale: false,
      isPlaceholderData: false,
      isRefetching: false,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      fetchStatus: 'idle',
      isInitialLoading: false,
      isRefetchError: false,
      isLoadingError: false,
      promise: Promise.resolve({ members: [] }),
    });

    mockMutate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(CommentForm, { projectId: 1, ticketId: 1 })
      )
    );
  };

  describe('Character Limit Validation', () => {
    it('should display character count', () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );
      expect(textarea).toBeDefined();

      // Character count should be displayed
      expect(screen.getByText(/0 \/ 2000/)).toBeDefined();
    });

    it('should update character count as user types', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      fireEvent.change(textarea, { target: { value: 'Hello' } });

      await waitFor(() => {
        expect(screen.getByText(/5 \/ 2000/)).toBeDefined();
      });
    });

    it('should show error styling when over character limit', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      // Create a string over 2000 characters
      const longText = 'a'.repeat(2001);
      fireEvent.change(textarea, { target: { value: longText } });

      await waitFor(() => {
        // Character count should show red styling (text-red class)
        const charCount = screen.getByText(/2001 \/ 2000/);
        expect(charCount.className).toContain('text-red');
      });
    });

    it('should disable submit button when over character limit', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      const longText = 'a'.repeat(2001);
      fireEvent.change(textarea, { target: { value: longText } });

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should display Cmd+Enter shortcut hint', () => {
      renderComponent();

      expect(screen.getByText(/Cmd\+Enter/)).toBeDefined();
    });

    it('should submit form on Cmd+Enter when valid', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      // Type valid content
      fireEvent.change(textarea, { target: { value: 'Test comment' } });

      // Simulate Cmd+Enter
      fireEvent.keyDown(window, {
        key: 'Enter',
        metaKey: true,
      });

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
      });
    });

    it('should submit form on Ctrl+Enter when valid', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      // Type valid content
      fireEvent.change(textarea, { target: { value: 'Test comment' } });

      // Simulate Ctrl+Enter
      fireEvent.keyDown(window, {
        key: 'Enter',
        ctrlKey: true,
      });

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
      });
    });

    it('should not submit on Cmd+Enter when content is empty', async () => {
      renderComponent();

      // Simulate Cmd+Enter without typing
      fireEvent.keyDown(window, {
        key: 'Enter',
        metaKey: true,
      });

      // Wait a bit to ensure no submission
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('should not submit on Cmd+Enter when over character limit', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      // Type content over limit
      const longText = 'a'.repeat(2001);
      fireEvent.change(textarea, { target: { value: longText } });

      // Simulate Cmd+Enter
      fireEvent.keyDown(window, {
        key: 'Enter',
        metaKey: true,
      });

      // Wait a bit to ensure no submission
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('should disable form while submitting', () => {
      vi.mocked(useCreateComment).mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isPending: true,
        isSuccess: false,
        isError: false,
        isIdle: false,
        data: undefined,
        error: null,
        variables: undefined,
        context: undefined,
        reset: vi.fn(),
        status: 'pending',
        failureCount: 0,
        failureReason: null,
        submittedAt: Date.now(),
      });

      renderComponent();

      const submitButton = screen.getByRole('button', { name: /submitting/i });
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('should show "Submitting..." text during submission', () => {
      vi.mocked(useCreateComment).mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isPending: true,
        isSuccess: false,
        isError: false,
        isIdle: false,
        data: undefined,
        error: null,
        variables: undefined,
        context: undefined,
        reset: vi.fn(),
        status: 'pending',
        failureCount: 0,
        failureReason: null,
        submittedAt: Date.now(),
      });

      renderComponent();

      expect(screen.getByText('Submitting...')).toBeDefined();
    });

    it('should disable textarea while members are loading', () => {
      vi.mocked(useProjectMembers).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        status: 'pending',
        isSuccess: false,
        isFetching: true,
        isPending: true,
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isStale: false,
        isPlaceholderData: false,
        isRefetching: false,
        refetch: vi.fn(),
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        fetchStatus: 'fetching',
        isInitialLoading: true,
        isRefetchError: false,
        isLoadingError: false,
        promise: Promise.resolve({ members: [] }),
      });

      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );
      expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    });
  });

  describe('Form Submission', () => {
    it('should enable submit button when content is valid', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );

      fireEvent.change(textarea, { target: { value: 'Valid comment' } });

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    it('should submit form on button click', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );
      fireEvent.change(textarea, { target: { value: 'Test comment' } });

      const submitButton = screen.getByRole('button', { name: /comment/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({ content: 'Test comment' });
      });
    });

    it('should not submit when content is only whitespace', async () => {
      renderComponent();

      const textarea = screen.getByPlaceholderText(
        /write a comment/i
      );
      fireEvent.change(textarea, { target: { value: '   ' } });

      const submitButton = screen.getByRole('button', { name: /comment/i });
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
