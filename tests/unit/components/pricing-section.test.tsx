/**
 * RTL Component Tests: PricingSection
 *
 * Tests for the landing page pricing section.
 * Verifies plan cards, CTAs, and FAQ accordion render correctly.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingSection } from '@/components/landing/pricing-section';

describe('PricingSection', () => {
  it('should render all three pricing cards', () => {
    render(<PricingSection />);

    expect(screen.getByTestId('pricing-card-free')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-card-pro')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-card-team')).toBeInTheDocument();
  });

  it('should render correct prices', () => {
    render(<PricingSection />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$15')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
  });

  it('should render correct CTA text per plan', () => {
    render(<PricingSection />);

    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
    const trialButtons = screen.getAllByRole('button', { name: 'Start 14-day trial' });
    expect(trialButtons).toHaveLength(2);
  });

  it('should mark Pro plan as most popular', () => {
    render(<PricingSection />);

    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('should render FAQ questions', () => {
    render(<PricingSection />);

    expect(screen.getByText('What is BYOK (Bring Your Own Key)?')).toBeInTheDocument();
    expect(screen.getByText('Which AI agents are supported?')).toBeInTheDocument();
  });

  it('should toggle FAQ answers on click', async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    // Answer should not be visible initially
    expect(screen.queryByText(/On the Free plan, you provide your own API key/)).not.toBeInTheDocument();

    // Click to open
    await user.click(screen.getByTestId('faq-toggle-0'));
    expect(screen.getByText(/On the Free plan, you provide your own API key/)).toBeInTheDocument();

    // Click again to close
    await user.click(screen.getByTestId('faq-toggle-0'));
    expect(screen.queryByText(/On the Free plan, you provide your own API key/)).not.toBeInTheDocument();
  });
});
