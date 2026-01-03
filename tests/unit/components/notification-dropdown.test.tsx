/**
 * RTL Component Tests: NotificationDropdown
 *
 * Tests for the notification dropdown component.
 * Verifies rendering, overflow handling, and responsive behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { NotificationDropdown } from '@/app/components/notifications/notification-dropdown';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({}),
}));

// Mock notification hooks
const mockNotifications = {
  notifications: [
    {
      id: 1,
      recipientId: 'user1',
      actorId: 'user2',
      commentId: 1,
      ticketId: 1,
      read: false,
      createdAt: new Date().toISOString(),
      projectId: 1,
      ticketKey: 'TEST-1',
      actorName: 'Test Actor',
      actorImage: null,
      commentPreview: 'Test comment',
    },
    {
      id: 2,
      recipientId: 'user1',
      actorId: 'user3',
      commentId: 2,
      ticketId: 2,
      read: true,
      createdAt: new Date().toISOString(),
      projectId: 1,
      ticketKey: 'TEST-2',
      actorName: 'Another Actor',
      actorImage: null,
      commentPreview: 'Another comment',
    },
  ],
  unreadCount: 1,
  hasMore: false,
};

vi.mock('@/app/components/notifications/use-notifications', () => ({
  useNotifications: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useMarkNotificationRead: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useMarkAllNotificationsRead: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Import the mocked hooks to control them
import { useNotifications } from '@/app/components/notifications/use-notifications';
const mockUseNotifications = vi.mocked(useNotifications);

describe('NotificationDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  describe('Rendering', () => {
    it('should render notification dropdown container', () => {
      renderWithProviders(<NotificationDropdown />);
      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });

    it('should display header with title', () => {
      renderWithProviders(<NotificationDropdown />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('should show loading state while fetching', () => {
      mockUseNotifications.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<NotificationDropdown />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show empty state when no notifications', () => {
      mockUseNotifications.mockReturnValue({
        data: { notifications: [], unreadCount: 0, hasMore: false },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<NotificationDropdown />);
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  describe('Notification List', () => {
    beforeEach(() => {
      mockUseNotifications.mockReturnValue({
        data: mockNotifications,
        isLoading: false,
        error: null,
      });
    });

    it('should render notification items', () => {
      renderWithProviders(<NotificationDropdown />);
      const items = screen.getAllByTestId('notification-item');
      expect(items).toHaveLength(2);
    });

    it('should show unread indicator for unread notifications', () => {
      renderWithProviders(<NotificationDropdown />);
      const unreadIndicators = screen.getAllByTestId('unread-indicator');
      expect(unreadIndicators).toHaveLength(1);
    });

    it('should show "Mark all as read" button when there are unread notifications', () => {
      renderWithProviders(<NotificationDropdown />);
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    it('should not show "Mark all as read" button when all notifications are read', () => {
      mockUseNotifications.mockReturnValue({
        data: {
          ...mockNotifications,
          notifications: mockNotifications.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<NotificationDropdown />);
      expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Overflow Handling', () => {
    beforeEach(() => {
      mockUseNotifications.mockReturnValue({
        data: mockNotifications,
        isLoading: false,
        error: null,
      });
    });

    it('should have constrained height on mobile viewports', () => {
      renderWithProviders(<NotificationDropdown />);

      // Find the scroll container by its role and classes
      const container = screen.getByTestId('notification-dropdown');
      const scrollContainer = container.querySelector('[class*="max-h-"]');

      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('max-h-[min(400px,calc(100vh-120px))]');
    });

    it('should maintain minimum height for usability', () => {
      renderWithProviders(<NotificationDropdown />);

      const container = screen.getByTestId('notification-dropdown');
      const scrollContainer = container.querySelector('[class*="min-h-"]');

      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('min-h-[200px]');
    });
  });

  describe('Error Handling', () => {
    it('should display error state when fetch fails', () => {
      const error = new Error('Failed to fetch notifications');
      mockUseNotifications.mockReturnValue({
        data: null,
        isLoading: false,
        error,
      });

      renderWithProviders(<NotificationDropdown />);
      expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch notifications')).toBeInTheDocument();
    });
  });
});
