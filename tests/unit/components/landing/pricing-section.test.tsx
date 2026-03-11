import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingSection } from '@/components/landing/pricing-section';
import { marketingContent } from '@/lib/marketing/pricing-content';

describe('PricingSection', () => {
  it('renders plan cards in defined order with CTA analytics hooks', () => {
    render(<PricingSection />);

    const section = screen.getByTestId('pricing-section');
    expect(section).toBeInTheDocument();

    const cards = screen.getAllByTestId('plan-card');
    const planOrder = cards.map((card) => card.getAttribute('data-plan'));
    expect(planOrder).toEqual(marketingContent.plans.map((plan) => plan.id));

    cards.forEach((card, index) => {
      const plan = marketingContent.plans[index];
      expect(card).toHaveAttribute('data-analytics-id', plan.analyticsId);

      const ctaButton = within(card).getByRole('link', { name: plan.cta.label });
      expect(ctaButton).toHaveAttribute('href', plan.cta.href);
      expect(ctaButton).toHaveAttribute('data-analytics-id', plan.cta.analyticsId);
    });
  });

  it('shows the configured disclaimer text under the pricing section', () => {
    render(<PricingSection />);

    expect(screen.getByText(marketingContent.disclaimer)).toBeInTheDocument();
  });

  it('renders FAQ entries with correct default expansion and analytics ids', async () => {
    render(<PricingSection />);

    const byokEntry = marketingContent.faq[0];
    const agentsEntry = marketingContent.faq[1];

    const byokTrigger = screen.getByRole('button', { name: byokEntry.question });
    expect(byokTrigger).toHaveAttribute('data-analytics-id', byokEntry.analyticsId);
    expect(byokTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(byokEntry.answer)).toBeVisible();

    const agentsTrigger = screen.getByRole('button', { name: agentsEntry.question });
    expect(agentsTrigger).toHaveAttribute('data-analytics-id', agentsEntry.analyticsId);
    expect(agentsTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(agentsEntry.answer)).not.toBeVisible();

    const user = userEvent.setup();
    await user.click(agentsTrigger);
    expect(agentsTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(agentsEntry.answer)).toBeVisible();
  });
});
