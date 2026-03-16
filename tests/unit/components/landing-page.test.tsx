import { describe, it, expect, vi } from 'vitest';
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

import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { CTASection } from '@/components/landing/cta-section';

describe('HeroSection', () => {
  it('renders the core value proposition and primary calls to action', () => {
    render(<HeroSection />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /an ai delivery system for teams that ship/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/turn backlog chaos into a traceable shipping rhythm/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/auth/signin');
    expect(screen.getByRole('link', { name: 'See workflow' })).toHaveAttribute('href', '#workflow');
    expect(screen.getByText('Built for AI-first product delivery')).toBeInTheDocument();
    expect(screen.getByText('Every step stays reviewable')).toBeInTheDocument();
  });
});

describe('FeaturesGrid', () => {
  it('renders the repositioned feature narrative and proof points', () => {
    render(<FeaturesGrid />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /designed for calm, auditable execution/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Clear ownership across every stage')).toBeInTheDocument();
    expect(screen.getByText('Built-in quality gates')).toBeInTheDocument();
    expect(screen.getByText('Shared context, not scattered prompts')).toBeInTheDocument();
    expect(screen.getAllByText('Workflow clarity without extra coordination layers').length).toBeGreaterThan(0);
  });
});

describe('WorkflowSection', () => {
  it('renders the workflow heading and all delivery stages', () => {
    render(<WorkflowSection />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /one workflow from ticket intake to shipped code/i,
      })
    ).toBeInTheDocument();

    ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY'].forEach((stage) => {
      expect(screen.getAllByText(stage).length).toBeGreaterThan(0);
    });
  });
});

describe('CTASection', () => {
  it('renders a final CTA with sign-in and pricing links', () => {
    render(<CTASection />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /replace status chasing with visible momentum/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Launch your workspace' })).toHaveAttribute(
      'href',
      '/auth/signin'
    );
    expect(screen.getByRole('link', { name: 'Review pricing' })).toHaveAttribute('href', '#pricing');
  });
});
