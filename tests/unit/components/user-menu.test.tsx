/**
 * RTL Component Tests: UserMenu
 *
 * Tests for the user menu dropdown component.
 * Verifies settings links (Billing, API Tokens) are present.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-auth session
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: {
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: null,
      },
    },
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

  describe('Admin entry (AIB-796)', () => {
    it('renders Admin item when isAdmin=true with href=/admin between AI Credentials and Sign out', async () => {
      const user = userEvent.setup();
      render(<UserMenu isAdmin={true} />);

      await user.click(screen.getByTestId('user-menu'));

      const adminItem = screen.getByRole('menuitem', { name: /admin/i });
      expect(adminItem).toBeInTheDocument();
      expect(adminItem).toHaveAttribute('href', '/admin');

      // Verify position: AI Credentials → Admin → Sign out
      const menuItems = screen.getAllByRole('menuitem');
      const labels = menuItems.map((el) => el.textContent?.trim() ?? '');
      const aiCredsIdx = labels.findIndex((l) => /ai credentials/i.test(l));
      const adminIdx = labels.findIndex((l) => /^admin$/i.test(l));
      const signOutIdx = labels.findIndex((l) => /sign out/i.test(l));
      expect(aiCredsIdx).toBeGreaterThanOrEqual(0);
      expect(adminIdx).toBeGreaterThan(aiCredsIdx);
      expect(signOutIdx).toBeGreaterThan(adminIdx);
    });

    it('does NOT render Admin item when isAdmin=false', async () => {
      const user = userEvent.setup();
      const { container } = render(<UserMenu isAdmin={false} />);

      await user.click(screen.getByTestId('user-menu'));

      expect(screen.queryByRole('menuitem', { name: /^admin$/i })).not.toBeInTheDocument();
      expect(container.innerHTML).not.toMatch(/\/admin(?!\/)/);
    });

    it('does NOT render Admin item when isAdmin is undefined (default false)', async () => {
      const user = userEvent.setup();
      const { container } = render(<UserMenu />);

      await user.click(screen.getByTestId('user-menu'));

      expect(screen.queryByRole('menuitem', { name: /^admin$/i })).not.toBeInTheDocument();
      expect(container.innerHTML).not.toMatch(/\/admin(?!\/)/);
    });

    it('preserves pre-existing item count and order when isAdmin=false', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByTestId('user-menu'));

      const menuItems = screen.getAllByRole('menuitem');
      const labels = menuItems.map((el) => el.textContent?.trim() ?? '');
      expect(labels).toEqual([
        expect.stringMatching(/profile/i),
        expect.stringMatching(/billing/i),
        expect.stringMatching(/api tokens/i),
        expect.stringMatching(/ai credentials/i),
        expect.stringMatching(/sign out/i),
      ]);
    });
  });
});
