import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/landing/components/animated-ticket-background', () => ({
  default: ({ className }: { className?: string }) => (
    <div className={className} data-testid="animated-ticket-background" />
  ),
}));

import { HeroSection } from '@/components/landing/hero-section';

describe('HeroSection', () => {
  it('renders accessible CTA links and proof metrics', () => {
    render(<HeroSection />);

    expect(
      screen.getByRole('heading', {
        name: 'AI delivery, without the workflow chaos',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute(
      'href',
      '/auth/signin'
    );
    expect(screen.getByRole('link', { name: 'See workflow' })).toHaveAttribute(
      'href',
      '#workflow'
    );
    expect(screen.getByText('Production-ready flow')).toBeInTheDocument();
    expect(screen.getByText('Team-visible progress')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
  });
});
