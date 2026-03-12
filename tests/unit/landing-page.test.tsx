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
  CTASection: () => <section data-testid="cta-section">CTA</section>,
}));

import LandingPage from '@/app/landing/page';

describe('LandingPage', () => {
  it('renders the pricing section between workflow and final CTA', () => {
    render(<LandingPage />);

    const workflow = screen.getByTestId('workflow-section');
    const pricing = screen.getByTestId('pricing-section');
    const cta = screen.getByTestId('cta-section');

    expect(workflow.compareDocumentPosition(pricing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pricing.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
