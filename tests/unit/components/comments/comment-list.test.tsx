/**
 * CommentList Component Tests
 *
 * Tests for the CommentList component which displays a list of comments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockComment, createMockUser } from '../helpers/factories';
import { CommentList } from '@/components/comments/comment-list';

// Mock useComments with different states - CommentWithUser uses 'user' and 'userId'
interface MockComment {
  id: number;
  content: string;
  userId: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}
const mockComments: MockComment[] = [];
let mockIsLoading = false;
let mockError: Error | null = null;

vi.mock('@/app/lib/hooks/queries/use-comments', () => ({
  useComments: () => ({
    data: mockError ? null : {
      comments: mockComments,
      mentionedUsers: {},
      currentUserId: 'user-1',
    },
    isLoading: mockIsLoading,
    error: mockError,
  }),
}));

vi.mock('@/app/lib/hooks/mutations/use-delete-comment', () => ({
  useDeleteComment: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/app/lib/hooks/mutations/use-create-comment', () => ({
  useCreateComment: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/app/lib/hooks/queries/useProjectMembers', () => ({
  useProjectMembers: () => ({
    data: { members: [] },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComments.length = 0;
    mockIsLoading = false;
    mockError = null;
  });

  describe('rendering', () => {
    it('renders all comments with author and content', () => {
      mockComments.push(
        {
          id: 1,
          content: 'First comment',
          userId: 'user-1',
          createdAt: new Date(),
          user: {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com',
            image: null,
          },
        },
        {
          id: 2,
          content: 'Second comment',
          userId: 'user-2',
          createdAt: new Date(),
          user: {
            id: 'user-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            image: null,
          },
        }
      );

      renderWithProviders(
        <CommentList projectId={1} ticketId={1} />
      );

      expect(screen.getByText('First comment')).toBeInTheDocument();
      expect(screen.getByText('Second comment')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('shows empty state when no comments', () => {
      // mockComments is already empty from beforeEach

      renderWithProviders(
        <CommentList projectId={1} ticketId={1} />
      );

      expect(screen.getByText('No comments')).toBeInTheDocument();
    });

    it('renders comment form', () => {
      renderWithProviders(
        <CommentList projectId={1} ticketId={1} />
      );

      expect(
        screen.getByPlaceholderText(/write a comment/i)
      ).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching', () => {
      mockIsLoading = true;

      renderWithProviders(
        <CommentList projectId={1} ticketId={1} />
      );

      // The loading spinner should be present
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', () => {
      mockError = new Error('Network error');

      renderWithProviders(
        <CommentList projectId={1} ticketId={1} />
      );

      expect(screen.getByText('Failed to load comments')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('data-testid', () => {
    it('has correct data-testid for list', () => {
      renderWithProviders(
        <CommentList projectId={1} ticketId={1} />
      );

      expect(screen.getByTestId('comment-list')).toBeInTheDocument();
    });
  });
});
