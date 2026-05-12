/**
 * RTL Component Tests: UserMenu
 *
 * Tests for the user menu dropdown component.
 * - Verifies settings links (Billing, API Tokens) are present.
 * - Verifies the Admin entry is only rendered for admin sessions (AIB-799).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type MockUser = {
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

let currentUser: MockUser = {
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  isAdmin: false,
};

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: currentUser },
  }),
  signOut: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { UserMenu } from '@/components/auth/user-menu';

describe('UserMenu', () => {
  beforeEach(() => {
    currentUser = {
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      isAdmin: false,
    };
  });

  it('should render settings links in dropdown', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    // Open the dropdown
    const trigger = screen.getByTestId('user-menu');
    await user.click(trigger);

    // Verify Billing link (Radix renders as menuitem)
    const billingItem = screen.getByRole('menuitem', { name: /billing/i });
    expect(billingItem).toBeInTheDocument();
    expect(billingItem).toHaveAttribute('href', '/settings/billing');

    // Verify API Tokens link
    const tokensItem = screen.getByRole('menuitem', { name: /api tokens/i });
    expect(tokensItem).toBeInTheDocument();
    expect(tokensItem).toHaveAttribute('href', '/settings/tokens');
  });

  it('should render sign out option', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByTestId('user-menu'));

    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  describe('Admin entry (AIB-799)', () => {
    it('does not render the Admin entry for non-admin sessions', async () => {
      currentUser = { ...currentUser, isAdmin: false };
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByTestId('user-menu'));

      expect(
        screen.queryByRole('menuitem', { name: /admin/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-menu-admin-link')).not.toBeInTheDocument();
    });

    it('renders an Admin entry linking to /admin for admin sessions', async () => {
      currentUser = { ...currentUser, isAdmin: true };
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByTestId('user-menu'));

      const adminItem = screen.getByRole('menuitem', { name: /admin/i });
      expect(adminItem).toBeInTheDocument();
      expect(adminItem).toHaveAttribute('href', '/admin');
    });
  });
});
