/**
 * RTL Component Tests: PricingSection
 *
 * Validates marketing pricing cards render expected plans,
 * call-to-action labels, and FAQ content.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PricingSection } from '@/components/landing/pricing-section';

describe('PricingSection', () => {
  it('should render Free, Pro, and Team plans with correct CTAs', () => {
    render(<PricingSection />);

    const freeCard = screen.getByRole('article', { name: /free plan/i });
    const proCard = screen.getByRole('article', { name: /pro plan/i });
    const teamCard = screen.getByRole('article', { name: /team plan/i });

    expect(within(freeCard).getByRole('heading', { name: 'Free', level: 3 })).toBeInTheDocument();
    expect(within(freeCard).getByRole('link', { name: 'Get Started' })).toBeInTheDocument();

    expect(within(proCard).getByRole('heading', { name: 'Pro', level: 3 })).toBeInTheDocument();
    expect(
      within(proCard).getByRole('link', { name: 'Start 14-day trial' }),
    ).toBeInTheDocument();

    expect(within(teamCard).getByRole('heading', { name: 'Team', level: 3 })).toBeInTheDocument();
    expect(
      within(teamCard).getByRole('link', { name: 'Start 14-day trial' }),
    ).toBeInTheDocument();
  });

  it('should include FAQ entries for BYOK and supported agents', () => {
    render(<PricingSection />);

    expect(screen.getByRole('heading', { name: /bring your own key/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /agents are supported/i })).toBeInTheDocument();
  });
});
