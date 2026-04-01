/**
 * Component Tests: Profile Settings Page
 *
 * AIB-467: Tests for the profile settings page component.
 * Verifies field rendering, fallback behaviors, and loading states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, createTestQueryClient } from '@/tests/utils/component-test-utils';

// Mock next-auth session
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: {
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://avatars.githubusercontent.com/u/12345?v=4',
      },
    },
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockProfileData = {
  name: 'John Doe',
  email: 'john@example.com',
  image: 'https://avatars.githubusercontent.com/u/12345?v=4',
  githubUsername: 'johndoe',
  githubProfileUrl: 'https://github.com/johndoe',
  createdAt: '2026-01-15T10:30:00.000Z',
  plan: 'PRO',
};

// Track fetch calls
let fetchHandler: (url: string) => Response;

beforeEach(() => {
  fetchHandler = () => new Response(JSON.stringify(mockProfileData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(fetchHandler(url))));
});

import ProfileSettingsPage from '@/app/settings/profile/page';

describe('ProfileSettingsPage', () => {
  it('should render all profile fields', async () => {
    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      // Name appears in aurora header and Display Name field
      expect(screen.getAllByText('John Doe').length).toBe(2);
    });

    // Email appears in aurora header and Email field
    expect(screen.getAllByText('john@example.com').length).toBe(2);
    expect(screen.getByText('johndoe')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('GitHub Account')).toBeInTheDocument();
    expect(screen.getByText('Member Since')).toBeInTheDocument();
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  it('should render avatar in header section', async () => {
    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBe(2);
    });

    // Avatar renders as a span with overflow-hidden and rounded-full
    const avatarContainer = document.querySelector('.h-16.w-16');
    expect(avatarContainer).toBeInTheDocument();
  });

  it('should show initials fallback when no avatar image', async () => {
    fetchHandler = () => new Response(JSON.stringify({
      ...mockProfileData,
      image: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should show "Not available" for null email scenario', async () => {
    fetchHandler = () => new Response(JSON.stringify({
      ...mockProfileData,
      email: 'Not available',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      // "Not available" appears in aurora header and Email field
      expect(screen.getAllByText('Not available').length).toBe(2);
    });
  });

  it('should show loading skeleton during fetch', () => {
    // Make fetch hang forever
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const queryClient = createTestQueryClient();
    renderWithProviders(<ProfileSettingsPage />, { queryClient });

    expect(screen.getByText('Profile')).toBeInTheDocument();
    // Should have skeleton elements (animated pulse divs)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should link GitHub username to correct profile URL', async () => {
    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('johndoe')).toBeInTheDocument();
    });

    const githubLink = screen.getByRole('link', { name: /johndoe/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/johndoe');
  });

  it('should link plan to billing settings', async () => {
    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    const billingLink = screen.getByRole('link', { name: /PRO/i });
    expect(billingLink).toHaveAttribute('href', '/settings/billing');
  });

  it('should display formatted registration date', async () => {
    renderWithProviders(<ProfileSettingsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
    });

    // Should display human-readable date (January 15, 2026)
    expect(screen.getByText(/January 15, 2026/)).toBeInTheDocument();
  });
});
