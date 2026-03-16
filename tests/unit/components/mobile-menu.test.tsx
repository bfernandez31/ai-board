/**
 * RTL Component Tests: MobileMenu
 *
 * Tests for the mobile menu sheet component.
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
  default: ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
}));

import { MobileMenu } from '@/components/layout/mobile-menu';

describe('MobileMenu', () => {
  it('should render settings links when menu is open', async () => {
    const user = userEvent.setup();
    render(<MobileMenu />);

    // Open the sheet
    const trigger = screen.getByRole('button', { name: /toggle menu/i });
    await user.click(trigger);

    // Verify Billing link
    const billingLink = screen.getByRole('link', { name: /billing/i });
    expect(billingLink).toBeInTheDocument();
    expect(billingLink).toHaveAttribute('href', '/settings/billing');

    // Verify API Tokens link
    const tokensLink = screen.getByRole('link', { name: /api tokens/i });
    expect(tokensLink).toBeInTheDocument();
    expect(tokensLink).toHaveAttribute('href', '/settings/tokens');
  });

  it('should render sign out button', async () => {
    const user = userEvent.setup();
    render(<MobileMenu />);

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));

    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });
});
