/**
 * RTL Component Tests: Footer
 *
 * Tests for the global footer component.
 * Verifies legal links render with correct hrefs and
 * that the footer is hidden on board pages.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/footer';

// Mock next/navigation
const mockUsePathname = vi.fn<() => string | null>();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('Footer', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('should render Terms of Service link with correct href', () => {
    render(<Footer />);

    const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/legal/terms');
  });

  it('should render Privacy Policy link with correct href', () => {
    render(<Footer />);

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/legal/privacy');
  });

  it('should render copyright notice', () => {
    render(<Footer />);

    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`${currentYear}.*AI Board`))).toBeInTheDocument();
  });

  it('should be hidden on board pages', () => {
    mockUsePathname.mockReturnValue('/projects/123/board');
    const { container } = render(<Footer />);
    expect(container.innerHTML).toBe('');
  });

  it('should be visible on non-board pages', () => {
    mockUsePathname.mockReturnValue('/projects/123/settings');
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
  });
});
