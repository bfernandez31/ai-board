/**
 * RTL Component Tests: Header
 *
 * Tests for the header component.
 * Verifies search visibility is limited to board page only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock pathname - MUST be before component import
let mockPathname = '/projects/1/board';
let mockSessionStatus: 'authenticated' | 'unauthenticated' | 'loading' = 'authenticated';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// Mock next-auth session
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: mockSessionStatus,
    data: mockSessionStatus === 'authenticated' ? { user: { name: 'Test' } } : null,
  }),
}));

// Mock TicketSearch to detect if it's rendered
vi.mock('@/components/search/ticket-search', () => ({
  TicketSearch: ({ projectId }: { projectId: number }) => (
    <div data-testid="ticket-search">Search for project {projectId}</div>
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
    mockSessionStatus = 'authenticated';

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

  describe('Search Visibility', () => {
    it('should show search on board page', async () => {
      mockPathname = '/projects/1/board';
      renderHeader();

      // Wait for project info fetch
      const search = await screen.findByTestId('ticket-search');
      expect(search).toBeInTheDocument();
    });

    it('should NOT show search on analytics page', async () => {
      mockPathname = '/projects/1/analytics';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search should not be present
      expect(screen.queryByTestId('ticket-search')).not.toBeInTheDocument();
    });

    it('should NOT show search on settings page', async () => {
      mockPathname = '/projects/1/settings';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search should not be present
      expect(screen.queryByTestId('ticket-search')).not.toBeInTheDocument();
    });

    it('should NOT show search on homepage', async () => {
      mockPathname = '/';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search should not be present (no project context)
      expect(screen.queryByTestId('ticket-search')).not.toBeInTheDocument();
    });

    it('should NOT show search on projects list page', async () => {
      mockPathname = '/projects';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search should not be present (no specific project)
      expect(screen.queryByTestId('ticket-search')).not.toBeInTheDocument();
    });
  });

  describe('Board Page Detection', () => {
    it('should detect /projects/1/board as board page', async () => {
      mockPathname = '/projects/1/board';
      renderHeader();

      const search = await screen.findByTestId('ticket-search');
      expect(search).toBeInTheDocument();
    });

    it('should detect /projects/123/board as board page', async () => {
      mockPathname = '/projects/123/board';

      // Update fetch mock for project 123
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          id: 123,
          name: 'Another Project',
          githubOwner: 'owner',
          githubRepo: 'repo',
        }),
      });

      renderHeader();

      const search = await screen.findByTestId('ticket-search');
      expect(search).toBeInTheDocument();
    });

    it('should NOT match /projects/1/board/subpath as board page', async () => {
      mockPathname = '/projects/1/board/something';
      renderHeader();

      // Wait a bit for any async rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // isBoardPage regex requires exact match: /projects/\d+/board$
      expect(screen.queryByTestId('ticket-search')).not.toBeInTheDocument();
    });
  });

  describe('Marketing navigation', () => {
    it('shows a Pricing anchor link on the public landing page', async () => {
      mockPathname = '/';
      mockSessionStatus = 'unauthenticated';

      renderHeader();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
      expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features');
      expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('href', '#workflow');
    });
  });
});
