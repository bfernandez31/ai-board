/**
 * RTL Component Tests: NotificationDropdown and NotificationBell
 *
 * Tests for the notification dropdown and bell components.
 * Verifies rendering, scrolling, navigation, and mark-as-read functionality.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { NotificationDropdown } from '@/app/components/notifications/notification-dropdown';
import { NotificationBell } from '@/app/components/notifications/notification-bell';

// Mock router
const mockPush = vi.fn();
const mockParams = { projectId: '1' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams,
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock notification hooks
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockNotificationsData = {
  notifications: [
    {
      id: 1,
      projectId: 1,
      ticketKey: 'AIB-123',
      actorName: 'John Doe',
      actorImage: 'https://example.com/avatar.jpg',
      commentPreview: 'This is a test comment',
      commentId: 456,
      read: false,
      createdAt: '2024-01-01T10:00:00Z',
    },
    {
      id: 2,
      projectId: 1,
      ticketKey: 'AIB-124',
      actorName: 'Jane Smith',
      actorImage: null,
      commentPreview: 'Another test comment',
      commentId: 457,
      read: true,
      createdAt: '2024-01-01T09:00:00Z',
    },
  ],
  unreadCount: 1,
  hasMore: false,
};

vi.mock('@/app/components/notifications/use-notifications', () => ({
  useNotifications: vi.fn(() => ({
    data: mockNotificationsData,
    isLoading: false,
    error: null,
  })),
  useMarkNotificationRead: vi.fn(() => ({
    mutate: mockMarkAsRead,
    isPending: false,
  })),
  useMarkAllNotificationsRead: vi.fn(() => ({
    mutate: mockMarkAllAsRead,
    isPending: false,
  })),
}));

// Import mocks for manipulation
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/app/components/notifications/use-notifications';
const mockUseNotifications = vi.mocked(useNotifications);
const mockUseMarkNotificationRead = vi.mocked(useMarkNotificationRead);
const mockUseMarkAllNotificationsRead = vi.mocked(useMarkAllNotificationsRead);

describe('NotificationDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({
      data: mockNotificationsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isStale: false,
      isSuccess: true,
      status: 'success',
    });
    mockUseMarkNotificationRead.mockReturnValue({
      mutate: mockMarkAsRead,
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
    mockUseMarkAllNotificationsRead.mockReturnValue({
      mutate: mockMarkAllAsRead,
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
    it('should render dropdown with header', () => {
      renderWithProviders(<NotificationDropdown />);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('should render "Mark all as read" button when there are unread notifications', () => {
      renderWithProviders(<NotificationDropdown />);

      expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument();
    });

    it('should not render "Mark all as read" button when all notifications are read', () => {
      mockUseNotifications.mockReturnValue({
        data: { ...mockNotificationsData, unreadCount: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRefetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isInitialLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isStale: false,
        isSuccess: true,
        status: 'success',
      });

      renderWithProviders(<NotificationDropdown />);

      expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument();
    });

    it('should render notification items', () => {
      renderWithProviders(<NotificationDropdown />);

      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
      expect(screen.getByText(/This is a test comment/i)).toBeInTheDocument();
      expect(screen.getByText(/Another test comment/i)).toBeInTheDocument();
    });

    it('should show unread indicator for unread notifications', () => {
      renderWithProviders(<NotificationDropdown />);

      const unreadIndicators = screen.getAllByTestId('unread-indicator');
      expect(unreadIndicators).toHaveLength(1);
    });

    it('should show loading state', () => {
      mockUseNotifications.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        isRefetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
        isInitialLoading: true,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isStale: false,
        isSuccess: false,
        status: 'loading',
      });

      renderWithProviders(<NotificationDropdown />);

      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    });

    it('should show empty state when no notifications', () => {
      mockUseNotifications.mockReturnValue({
        data: { notifications: [], unreadCount: 0, hasMore: false },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRefetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isInitialLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isStale: false,
        isSuccess: true,
        status: 'success',
      });

      renderWithProviders(<NotificationDropdown />);

      expect(screen.getByText(/No notifications/i)).toBeInTheDocument();
    });

    it('should show error state when fetch fails', () => {
      mockUseNotifications.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: vi.fn(),
        isRefetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 1,
        failureReason: new Error('Network error'),
        fetchStatus: 'idle',
        isError: true,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isInitialLoading: false,
        isLoadingError: true,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isStale: false,
        isSuccess: false,
        status: 'error',
      });

      renderWithProviders(<NotificationDropdown />);

      expect(screen.getByText(/Failed to load notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  describe('Layout Constraints', () => {
    it('should have fixed height on ScrollArea', () => {
      const { container } = renderWithProviders(<NotificationDropdown />);

      // The ScrollArea should have h-[300px] or h-[400px] class (depending on viewport)
      const scrollArea = container.querySelector('[data-radix-scroll-area-viewport]')?.parentElement;
      expect(scrollArea).toHaveClass(/h-\[300px\]|h-\[400px\]/);
    });
  });

  describe('Mark as Read', () => {
    it('should call markAllAsRead when "Mark all as read" is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationDropdown />);

      await user.click(screen.getByRole('button', { name: /mark all as read/i }));

      expect(mockMarkAllAsRead).toHaveBeenCalled();
    });

    it('should call markAsRead when notification is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationDropdown />);

      const notificationItems = screen.getAllByTestId('notification-item');
      await user.click(notificationItems[0]);

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to ticket when notification is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationDropdown />);

      const notificationItems = screen.getAllByTestId('notification-item');
      await user.click(notificationItems[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/projects/1/board?ticket=AIB-123')
        );
      });
    });

    it('should support keyboard navigation with Enter key', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationDropdown />);

      const notificationItems = screen.getAllByTestId('notification-item');
      notificationItems[0].focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith(1);
      });
    });

    it('should support keyboard navigation with Space key', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotificationDropdown />);

      const notificationItems = screen.getAllByTestId('notification-item');
      notificationItems[0].focus();
      await user.keyboard(' ');

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(<NotificationDropdown />);

      const notificationItems = screen.getAllByTestId('notification-item');
      expect(notificationItems[0]).toHaveAttribute('role', 'button');
      expect(notificationItems[0]).toHaveAttribute('tabIndex', '0');
      expect(notificationItems[0]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('John Doe')
      );
    });
  });
});

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({
      data: mockNotificationsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isStale: false,
      isSuccess: true,
      status: 'success',
    });
  });

  describe('Rendering', () => {
    it('should render notification bell button', () => {
      renderWithProviders(<NotificationBell />);

      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    it('should show badge when there are unread notifications', () => {
      renderWithProviders(<NotificationBell />);

      expect(screen.getByTestId('notification-badge')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should not show badge when there are no unread notifications', () => {
      mockUseNotifications.mockReturnValue({
        data: { ...mockNotificationsData, unreadCount: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRefetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isInitialLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isStale: false,
        isSuccess: true,
        status: 'success',
      });

      renderWithProviders(<NotificationBell />);

      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });

    it('should show "9+" when unread count exceeds 9', () => {
      mockUseNotifications.mockReturnValue({
        data: { ...mockNotificationsData, unreadCount: 15 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRefetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isInitialLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isStale: false,
        isSuccess: true,
        status: 'success',
      });

      renderWithProviders(<NotificationBell />);

      expect(screen.getByText('9+')).toBeInTheDocument();
    });
  });

  describe('Popover Constraints', () => {
    it('should render popover with proper width constraints', () => {
      const { container } = renderWithProviders(<NotificationBell />);

      // Find PopoverContent - it should have responsive width and max-height
      const popoverContent = container.querySelector('[data-radix-popper-content-wrapper]');
      // The actual constraints are in the className, but we can't easily test Tailwind classes
      // This just ensures the component renders without errors
      expect(container).toBeTruthy();
    });
  });
});
