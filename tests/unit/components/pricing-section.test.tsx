/**
 * RTL Component Tests: PricingSection
 *
 * Tests for the landing page pricing section component.
 * Verifies plan cards, CTA buttons, FAQ expand/collapse behavior.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingSection } from '@/components/landing/pricing-section';

describe('PricingSection', () => {
  it('should render three plan cards with correct names', () => {
    render(<PricingSection />);

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('should render correct prices for each plan', () => {
    render(<PricingSection />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$15')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
  });

  it('should display "Most Popular" badge on Pro card', () => {
    render(<PricingSection />);

    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('should render section title and subtitle', () => {
    render(<PricingSection />);

    expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    expect(screen.getByText('Choose the plan that fits your team')).toBeInTheDocument();
  });

  it('should render "Get Started" CTA for Free plan and "Start 14-day trial" for paid plans', () => {
    render(<PricingSection />);

    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
    const trialButtons = screen.getAllByRole('link', { name: 'Start 14-day trial' });
    expect(trialButtons).toHaveLength(2);
  });

  it('should link all CTA buttons to /auth/signin', () => {
    render(<PricingSection />);

    const getStartedLink = screen.getByRole('link', { name: 'Get Started' });
    expect(getStartedLink).toHaveAttribute('href', '/auth/signin');

    const trialLinks = screen.getAllByRole('link', { name: 'Start 14-day trial' });
    trialLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/auth/signin');
    });
  });

  it('should render FAQ questions', () => {
    render(<PricingSection />);

    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('What does BYOK (Bring Your Own Key) mean?')).toBeInTheDocument();
    expect(screen.getByText('Which AI agents and models are supported?')).toBeInTheDocument();
  });

  it('should expand and collapse FAQ items on click', async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    const byokTrigger = screen.getByText('What does BYOK (Bring Your Own Key) mean?');

    // Initially collapsed - content should not be visible
    expect(screen.queryByText(/Free plan, you provide your own API key/)).not.toBeInTheDocument();

    // Click to expand
    await user.click(byokTrigger);
    expect(screen.getByText(/Free plan, you provide your own API key/)).toBeInTheDocument();

    // Click again to collapse
    await user.click(byokTrigger);
    expect(screen.queryByText(/Free plan, you provide your own API key/)).not.toBeInTheDocument();
  });

  it('should have pricing section with id="pricing" for anchor navigation', () => {
    const { container } = render(<PricingSection />);

    expect(container.querySelector('#pricing')).toBeInTheDocument();
  });
});
