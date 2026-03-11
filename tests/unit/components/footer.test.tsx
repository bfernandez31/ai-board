/**
 * RTL Component Tests: Footer
 *
 * Tests for the global footer component.
 * Verifies legal links render with correct hrefs.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/footer';
import { marketingContent } from '@/lib/marketing/pricing-content';

describe('Footer', () => {
  it('renders configured footer links with analytics + new-tab handling', () => {
    render(<Footer />);

    const requiredLinkIds = ['footer.terms', 'footer.privacy', 'footer.github'] as const;
    requiredLinkIds.forEach((linkId) => {
      const linkConfig = marketingContent.footerLinks.find((link) => link.id === linkId);
      expect(linkConfig).toBeDefined();

      const anchor = screen.getByRole('link', { name: linkConfig!.label });
      expect(anchor).toBeInTheDocument();
      expect(anchor).toHaveAttribute('href', linkConfig!.href);
      expect(anchor).toHaveAttribute('data-analytics-id', linkConfig!.analyticsId);

      if (linkConfig!.opensInNewTab) {
        expect(anchor).toHaveAttribute('target', '_blank');
        expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
      } else {
        expect(anchor).not.toHaveAttribute('target');
      }
    });
  });

  it('should render copyright notice', () => {
    render(<Footer />);

    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`${currentYear}.*AI Board`))).toBeInTheDocument();
  });
});
