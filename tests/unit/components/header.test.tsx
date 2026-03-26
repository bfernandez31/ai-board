import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockPathname = '/projects/1/board';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { name: 'Test' } } }),
}));

vi.mock('@/components/layout/mobile-menu', () => ({
  MobileMenu: () => <div data-testid="mobile-menu">Mobile Menu</div>,
}));

vi.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

vi.mock('@/app/components/notifications/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

vi.mock('@/components/search/command-palette-trigger', () => ({
  CommandPaletteTrigger: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="command-palette-trigger" onClick={onClick} type="button">
      Open Palette
    </button>
  ),
}));

vi.mock('@/components/search/command-palette', () => ({
  CommandPalette: ({ open }: { open: boolean }) => (
    <div data-testid="command-palette" data-open={open} />
  ),
}));

import { Header } from '@/components/layout/header';

describe('Header', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    mockPathname = '/projects/1/board';

    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          id: 1,
          name: 'Test Project',
          githubOwner: 'owner',
          githubRepo: 'repo',
        }),
    }) as typeof fetch;
  });

  function renderHeader() {
    return render(
      <QueryClientProvider client={queryClient}>
        <Header />
      </QueryClientProvider>
    );
  }

  it('renders the command palette trigger on supported project pages', async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByTestId('command-palette-trigger')).toBeInTheDocument();
    });
  });

  it('keeps the command palette trigger on analytics pages', async () => {
    mockPathname = '/projects/1/analytics';
    renderHeader();

    await waitFor(() => {
      expect(screen.getByTestId('command-palette-trigger')).toBeInTheDocument();
    });
  });

  it('does not render the command palette trigger outside project pages', async () => {
    mockPathname = '/';
    renderHeader();

    await waitFor(() => {
      expect(screen.queryByTestId('command-palette-trigger')).not.toBeInTheDocument();
    });
  });

  it('does not treat nested board routes as shell pages', async () => {
    mockPathname = '/projects/1/board/details';
    renderHeader();

    await waitFor(() => {
      expect(screen.queryByTestId('command-palette-trigger')).not.toBeInTheDocument();
    });
  });

  it('renders the mobile menu fallback for project pages', async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
    });
  });
});
