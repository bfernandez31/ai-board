/**
 * RTL Component Tests: Pricing Section
 *
 * Tests for PricingCard, PricingSection, and PricingFAQ components.
 * Verifies correct plan data rendering, CTA links, and FAQ interactivity.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/link to render as a simple anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Import after mocks
import { PricingCard } from '@/components/landing/pricing-card';
import { PricingSection } from '@/components/landing/pricing-section';
import { PricingFAQ } from '@/components/landing/pricing-faq';

describe('PricingCard', () => {
  const defaultProps = {
    name: 'Pro',
    price: 1500,
    features: ['Unlimited projects', 'Unlimited tickets', '14-day free trial'],
    ctaLabel: 'Start 14-day trial',
    ctaHref: '/auth/signin',
    isPopular: true,
  };

  it('renders plan name', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('formats price from cents to dollars', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('$15')).toBeInTheDocument();
  });

  it('renders "Free" for free plan', () => {
    render(<PricingCard {...defaultProps} name="Free" price={0} />);
    expect(screen.getByText('Free', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders features list', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Unlimited projects')).toBeInTheDocument();
    expect(screen.getByText('Unlimited tickets')).toBeInTheDocument();
    expect(screen.getByText('14-day free trial')).toBeInTheDocument();
  });

  it('renders CTA button with correct label and href', () => {
    render(<PricingCard {...defaultProps} />);
    const link = screen.getByRole('link', { name: 'Start 14-day trial' });
    expect(link).toHaveAttribute('href', '/auth/signin');
  });

  it('renders "Most Popular" badge when isPopular is true', () => {
    render(<PricingCard {...defaultProps} isPopular={true} />);
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('does not render "Most Popular" badge when isPopular is false', () => {
    render(<PricingCard {...defaultProps} isPopular={false} />);
    expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
  });
});

describe('PricingSection', () => {
  it('renders section heading', () => {
    render(<PricingSection />);
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
  });

  it('renders three pricing cards with correct plan names', () => {
    render(<PricingSection />);
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('renders correct prices from PLANS config', () => {
    render(<PricingSection />);
    // Free plan shows "Free" text instead of "$0"
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    expect(screen.getByText('$15')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
  });

  it('renders "Most Popular" badge only on Pro card', () => {
    render(<PricingSection />);
    const badges = screen.getAllByText('Most Popular');
    expect(badges).toHaveLength(1);
  });

  it('renders "Get Started" CTA for Free plan', () => {
    render(<PricingSection />);
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('renders "Start 14-day trial" CTA for Pro and Team plans', () => {
    render(<PricingSection />);
    const trialLinks = screen.getAllByRole('link', { name: 'Start 14-day trial' });
    expect(trialLinks).toHaveLength(2);
  });

  it('all CTA links point to /auth/signin', () => {
    render(<PricingSection />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/auth/signin');
    });
  });
});

describe('PricingFAQ', () => {
  it('renders "Frequently Asked Questions" heading', () => {
    render(<PricingFAQ />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('renders 4 FAQ questions', () => {
    render(<PricingFAQ />);
    expect(screen.getByText('What does BYOK mean?')).toBeInTheDocument();
    expect(screen.getByText('Which AI agents are supported?')).toBeInTheDocument();
    expect(screen.getByText('How does the 14-day trial work?')).toBeInTheDocument();
    expect(screen.getByText('Can I switch plans?')).toBeInTheDocument();
  });

  it('expands FAQ answer on click', async () => {
    const user = userEvent.setup();
    render(<PricingFAQ />);

    const byokTrigger = screen.getByText('What does BYOK mean?');
    await user.click(byokTrigger);

    expect(screen.getByText(/Bring Your Own Key/i)).toBeInTheDocument();
  });

  it('shows AI agents answer with Claude and Codex', async () => {
    const user = userEvent.setup();
    render(<PricingFAQ />);

    const agentsTrigger = screen.getByText('Which AI agents are supported?');
    await user.click(agentsTrigger);

    const content = screen.getByText(/Claude/i);
    expect(content).toBeInTheDocument();
    expect(content.textContent).toMatch(/Codex/i);
  });
});
