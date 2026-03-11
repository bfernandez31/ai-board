/**
 * RTL Component Tests: Footer
 *
 * Tests for the footer component with legal page links.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/landing/footer';

describe('Footer', () => {
  it('renders the footer element', () => {
    render(<Footer />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('displays copyright text with current year', () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
  });

  it('renders Terms of Service link pointing to /terms-of-service', () => {
    render(<Footer />);
    const link = screen.getByTestId('footer-terms-link');
    expect(link).toHaveAttribute('href', '/terms-of-service');
    expect(link).toHaveTextContent('Terms of Service');
  });

  it('renders Privacy Policy link pointing to /privacy-policy', () => {
    render(<Footer />);
    const link = screen.getByTestId('footer-privacy-link');
    expect(link).toHaveAttribute('href', '/privacy-policy');
    expect(link).toHaveTextContent('Privacy Policy');
  });
});
