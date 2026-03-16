import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingPage from '@/app/landing/page';

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
  default: () => <div data-testid="animated-ticket-background" />,
}));

vi.mock('@/components/landing/mini-kanban-demo', () => ({
  MiniKanbanDemo: () => <div data-testid="mini-kanban-demo" />,
}));

describe('LandingPage', () => {
  it('renders sections in the contract order', () => {
    const { container } = render(<LandingPage />);
    const sections = Array.from(container.querySelectorAll('section[id]')).map((section) => section.id);

    expect(sections).toEqual(['hero', 'proof', 'workflow', 'capabilities', 'pricing', 'final-cta']);
  });

  it('renders the hero message and matching final CTA copy', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Turn one ticket into a reviewed, shippable change.',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: 'See what a structured AI delivery loop feels like in practice.',
      })
    ).toBeInTheDocument();

    const primaryLinks = screen.getAllByRole('link', { name: 'Get Started Free' });
    expect(primaryLinks).toHaveLength(4);
    primaryLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/auth/signin');
    });
  });

  it('renders proof signals and workflow-specific messaging', () => {
    render(<LandingPage />);

    const proof = screen.getByTestId('proof-section');
    const workflow = screen.getByRole('region', { name: 'A delivery workflow built for AI agents and humans.' });
    expect(within(proof).getByText('Specs before code')).toBeInTheDocument();
    expect(within(proof).getByText('Visible stage progression')).toBeInTheDocument();
    expect(within(proof).getByText('Workflow-backed execution')).toBeInTheDocument();

    expect(within(workflow).getAllByText('Generate a specification before implementation begins.').length).toBeGreaterThan(0);
    expect(within(workflow).getAllByText('Run implementation against the approved plan.').length).toBeGreaterThan(0);
  });

  it('keeps pricing CTA labels consistent with the funnel', () => {
    render(<LandingPage />);
    const pricing = screen.getByRole('region', { name: 'Start free, then unlock more throughput and collaboration.' });

    expect(screen.getByRole('heading', { name: 'Start free, then unlock more throughput and collaboration.' })).toBeInTheDocument();
    expect(within(pricing).getByRole('link', { name: 'Get Started Free' })).toBeInTheDocument();
    expect(within(pricing).getAllByRole('link', { name: 'Start 14-day trial' })).toHaveLength(2);
    expect(within(pricing).getByText('Free for solo evaluation and BYOK experimentation')).toBeInTheDocument();
  });
});
