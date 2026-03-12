import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingSection } from '@/components/landing/pricing-section';

describe('PricingSection', () => {
  it('renders the three plans with the expected CTAs', () => {
    render(<PricingSection />);

    expect(screen.getByRole('heading', { name: 'Simple pricing for every stage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/auth/signin');
    expect(screen.getAllByRole('link', { name: 'Start 14-day trial' })).toHaveLength(2);
  });

  it('renders the FAQ content for BYOK and supported agents', () => {
    render(<PricingSection />);

    expect(screen.getByText('Bring your own key (BYOK)?')).toBeInTheDocument();
    expect(screen.getByText(/Use your own model credentials when you need direct provider access/i)).toBeInTheDocument();
    expect(screen.getByText('Which agents are supported?')).toBeInTheDocument();
    expect(screen.getByText(/Claude and Codex workflows are supported/i)).toBeInTheDocument();
  });
});
