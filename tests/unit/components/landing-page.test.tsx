import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '@/app/landing/page';

describe('LandingPage', () => {
  it('renders the pricing section with three plans and matching CTAs', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: 'Choose the rollout that fits your team' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();

    expect(screen.getByText('1 project')).toBeInTheDocument();
    expect(screen.getByText('Unlimited projects')).toBeInTheDocument();
    expect(screen.getByText('Project members')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/auth/signin');
    expect(screen.getAllByRole('link', { name: 'Start 14-day trial' })).toHaveLength(2);
  });

  it('places the pricing section between workflow and final CTA content', () => {
    render(<LandingPage />);

    const workflowHeading = screen.getByRole('heading', {
      name: 'Streamlined Development Workflow',
    });
    const pricingHeading = screen.getByRole('heading', {
      name: 'Choose the rollout that fits your team',
    });
    const ctaHeading = screen.getByRole('heading', {
      name: 'Ready to Transform Your Workflow?',
    });

    expect(
      workflowHeading.compareDocumentPosition(pricingHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      pricingHeading.compareDocumentPosition(ctaHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders FAQ content directly beneath the pricing cards', () => {
    render(<LandingPage />);

    const faqHeading = screen.getByRole('heading', { name: 'Pricing FAQ' });
    const pricingHeading = screen.getByRole('heading', {
      name: 'Choose the rollout that fits your team',
    });

    expect(
      pricingHeading.compareDocumentPosition(faqHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText(/BYOK setup/i)).toBeInTheDocument();
    expect(screen.getByText(/Claude Code, Codex, and Gemini-based agents/i)).toBeInTheDocument();
  });
});
