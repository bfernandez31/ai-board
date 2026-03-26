/**
 * RTL Component Tests: Header
 *
 * Tests for the header component.
 * Verifies SearchTrigger visibility on all project pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock pathname - MUST be before component import
let mockPathname = '/projects/1/board';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// Mock next-auth session
vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { name: 'Test' } } }),
}));

// Mock SearchTrigger to detect if it's rendered
vi.mock('@/components/navigation/search-trigger', () => ({
  SearchTrigger: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="search-trigger" onClick={onClick}>Search...</button>
  ),
}));

// Mock other components to simplify
vi.mock('@/components/layout/mobile-menu', () => ({
  MobileMenu: () => <div data-testid="mobile-menu">Mobile Menu</div>,
}));

vi.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

vi.mock('@/app/components/notifications/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

// Import component AFTER mocks
import { Header } from '@/components/layout/header';

describe('Header', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    // Reset to default board page path
    mockPathname = '/projects/1/board';

    // Mock fetch for project info
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        id: 1,
        name: 'Test Project',
        githubOwner: 'owner',
        githubRepo: 'repo',
      }),
    });
  });

  const renderHeader = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Header />
      </QueryClientProvider>
    );
  };

  describe('Search Trigger Visibility', () => {
    it('should show search trigger on board page', async () => {
      mockPathname = '/projects/1/board';
      renderHeader();

      const trigger = await screen.findByTestId('search-trigger');
      expect(trigger).toBeInTheDocument();
    });

    it('should show search trigger on analytics page', async () => {
      mockPathname = '/projects/1/analytics';
      renderHeader();

      const trigger = await screen.findByTestId('search-trigger');
      expect(trigger).toBeInTheDocument();
    });

    it('should show search trigger on settings page', async () => {
      mockPathname = '/projects/1/settings';
      renderHeader();

      const trigger = await screen.findByTestId('search-trigger');
      expect(trigger).toBeInTheDocument();
    });

    it('should NOT show search trigger on homepage', async () => {
      mockPathname = '/';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search should not be present (no project context)
      expect(screen.queryByTestId('search-trigger')).not.toBeInTheDocument();
    });

    it('should NOT show search trigger on projects list page', async () => {
      mockPathname = '/projects';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search should not be present (no specific project)
      expect(screen.queryByTestId('search-trigger')).not.toBeInTheDocument();
    });
  });

  describe('Navigation Icons Removed', () => {
    it('should NOT show FileText, BarChart3, Activity icons in header', async () => {
      mockPathname = '/projects/1/board';
      renderHeader();

      // Wait for project info to load
      await screen.findAllByText('Test Project');

      // These icon links should no longer exist
      expect(screen.queryByLabelText('View project specifications on GitHub')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('View project analytics')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('View project activity')).not.toBeInTheDocument();
    });
  });
});
