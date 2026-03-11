/**
 * RTL Component Tests: Footer
 *
 * Tests for the global footer component.
 * Verifies legal links render with correct hrefs.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/footer';

describe('Footer', () => {
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

  it('should link to the GitHub repository', () => {
    render(<Footer />);

    const githubLink = screen.getByRole('link', { name: 'GitHub' });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/ai-board/ai-board');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
