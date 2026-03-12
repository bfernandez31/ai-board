import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PricingSection } from '@/components/landing/pricing-section';

describe('PricingSection', () => {
  it('renders three pricing cards in Free, Pro, Team order', () => {
    render(<PricingSection />);

    const cards = screen.getAllByTestId('pricing-card');
    expect(cards).toHaveLength(3);

    expect(within(cards[0]!).getByText('Free')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Pro')).toBeInTheDocument();
    expect(within(cards[2]!).getByText('Team')).toBeInTheDocument();
  });

  it('renders readable plan copy from the canonical feature list', () => {
    render(<PricingSection />);

    expect(screen.getByText('BYOK API key required')).toBeInTheDocument();
    expect(screen.getByText('Unlimited projects')).toBeInTheDocument();
    expect(screen.getByText('Advanced analytics')).toBeInTheDocument();
  });

  it('renders plan CTAs with the expected labels and auth entry href', () => {
    render(<PricingSection />);

    const ctaLinks = screen.getAllByRole('link', {
      name: /get started|start 14-day trial/i,
    });

    expect(ctaLinks).toHaveLength(3);
    expect(ctaLinks.map((link) => link.textContent)).toEqual([
      'Get Started',
      'Start 14-day trial',
      'Start 14-day trial',
    ]);
    expect(ctaLinks.every((link) => link.getAttribute('href') === '/auth/signin')).toBe(true);
  });

  it('renders the pricing anchor and the two FAQ entries', () => {
    render(<PricingSection />);

    expect(screen.getByTestId('pricing-section')).toHaveAttribute('id', 'pricing');
    expect(
      screen.getByText('Do I need to bring my own model API key?')
    ).toBeInTheDocument();
    expect(screen.getByText('Which coding agents can I use with AI Board?')).toBeInTheDocument();
    expect(screen.getByText(/supports Claude and Codex workflows/i)).toBeInTheDocument();
  });
});
