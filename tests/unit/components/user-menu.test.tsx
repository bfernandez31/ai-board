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
});
