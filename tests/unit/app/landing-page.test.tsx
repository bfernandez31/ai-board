import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/landing/hero-section', () => ({
  HeroSection: () => <section data-testid="hero-section">Hero</section>,
}));

vi.mock('@/components/landing/features-grid', () => ({
  FeaturesGrid: () => <section data-testid="features-section">Features</section>,
}));

vi.mock('@/components/landing/workflow-section', () => ({
  WorkflowSection: () => <section data-testid="workflow-section">Workflow</section>,
}));

vi.mock('@/components/landing/pricing-section', () => ({
  PricingSection: () => <section data-testid="pricing-section">Pricing</section>,
}));

vi.mock('@/components/landing/cta-section', () => ({
  CTASection: () => <section data-testid="final-cta-section">CTA</section>,
}));

import LandingPage from '@/app/landing/page';

describe('LandingPage', () => {
  it('renders pricing between the workflow and final CTA sections', () => {
    render(<LandingPage />);

    const sectionOrder = screen
      .getAllByTestId(/section$/)
      .map((section) => section.getAttribute('data-testid'));

    expect(sectionOrder).toEqual([
      'hero-section',
      'features-section',
      'workflow-section',
      'pricing-section',
      'final-cta-section',
    ]);
  });
});
