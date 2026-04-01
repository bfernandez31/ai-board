/**
 * Component Tests: Navigation Profile Link
 *
 * AIB-467: Verifies Profile is the first settings item in both UserMenu and MobileMenu.
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

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

import { UserMenu } from '@/components/auth/user-menu';
import { MobileMenu } from '@/components/layout/mobile-menu';

describe('Navigation Profile Link', () => {
  describe('UserMenu', () => {
    it('should show Profile as first settings item before Billing', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByTestId('user-menu'));

      const menuItems = screen.getAllByRole('menuitem');
      const profileItem = menuItems.find(item => item.textContent?.includes('Profile'));
      const billingItem = menuItems.find(item => item.textContent?.includes('Billing'));

      expect(profileItem).toBeInTheDocument();
      expect(profileItem).toHaveAttribute('href', '/settings/profile');
      expect(billingItem).toBeInTheDocument();

      // Profile should come before Billing
      const profileIndex = menuItems.indexOf(profileItem!);
      const billingIndex = menuItems.indexOf(billingItem!);
      expect(profileIndex).toBeLessThan(billingIndex);
    });
  });

  describe('MobileMenu', () => {
    it('should show Profile as first settings item before Billing', async () => {
      const user = userEvent.setup();
      render(<MobileMenu />);

      // Open the sheet menu
      const menuButton = screen.getByRole('button', { name: /toggle menu/i });
      await user.click(menuButton);

      const links = screen.getAllByRole('link');
      const profileLink = links.find(link => link.textContent?.includes('Profile'));
      const billingLink = links.find(link => link.textContent?.includes('Billing'));

      expect(profileLink).toBeDefined();
      expect(profileLink).toHaveAttribute('href', '/settings/profile');
      expect(billingLink).toBeDefined();

      // Profile should come before Billing
      const profileIndex = links.indexOf(profileLink!);
      const billingIndex = links.indexOf(billingLink!);
      expect(profileIndex).toBeLessThan(billingIndex);
    });
  });
});
