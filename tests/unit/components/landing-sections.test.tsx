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

vi.mock('@/components/landing/mini-kanban-demo', () => ({
  MiniKanbanDemo: ({ className }: { className?: string }) => (
    <div className={className} data-testid="mini-kanban-demo" />
  ),
}));

import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { CTASection } from '@/components/landing/cta-section';

describe('Landing sections', () => {
  it('renders the updated features, workflow, and CTA content', () => {
    render(
      <>
        <FeaturesGrid />
        <WorkflowSection />
        <CTASection />
      </>
    );

    expect(screen.getByRole('heading', { name: 'One workspace for product, engineering, and AI agents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A calmer path from ticket to shipped code' })).toBeInTheDocument();
    expect(screen.getByText('Designed for reviewable AI delivery')).toBeInTheDocument();
    expect(screen.getByText('Clear ownership')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ready to make AI work feel operational?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute(
      'href',
      '/auth/signin'
    );
  });
});
