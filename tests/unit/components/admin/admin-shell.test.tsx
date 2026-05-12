import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { AdminShell } from '@/components/admin/admin-shell';

describe('AdminShell (AIB-796 US3)', () => {
  beforeEach(() => {
    mockPathname = '/admin';
  });

  it('renders the "Espace admin" label', () => {
    render(<AdminShell>content</AdminShell>);
    expect(screen.getByText('Espace admin')).toBeInTheDocument();
  });

  it('renders the V1 sidebar items with their labels', () => {
    render(<AdminShell>content</AdminShell>);
    expect(screen.getByRole('link', { name: /accueil/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /insights llm/i })).toBeInTheDocument();
  });

  it('renders the "Retour à l\'app" link pointing to /', () => {
    render(<AdminShell>content</AdminShell>);
    const link = screen.getByRole('link', { name: /retour à l['’]app/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders children inside <main>', () => {
    render(<AdminShell><div data-testid="child-content">child</div></AdminShell>);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('marks only "Accueil" active when pathname=/admin', () => {
    mockPathname = '/admin';
    render(<AdminShell>content</AdminShell>);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    const insights = screen.getByRole('link', { name: /insights llm/i });
    expect(accueil).toHaveAttribute('data-active', 'true');
    expect(insights).not.toHaveAttribute('data-active');
  });

  it('marks only "Insights LLM" active when pathname=/admin/insights', () => {
    mockPathname = '/admin/insights';
    render(<AdminShell>content</AdminShell>);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    const insights = screen.getByRole('link', { name: /insights llm/i });
    expect(insights).toHaveAttribute('data-active', 'true');
    expect(accueil).not.toHaveAttribute('data-active');
  });

  it('marks only "Insights LLM" active for nested pathname /admin/insights/runs/42', () => {
    mockPathname = '/admin/insights/runs/42';
    render(<AdminShell>content</AdminShell>);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    const insights = screen.getByRole('link', { name: /insights llm/i });
    expect(insights).toHaveAttribute('data-active', 'true');
    expect(accueil).not.toHaveAttribute('data-active');
  });

  it('marks NO item active for adversarial pathname /admin/insights-fake', () => {
    mockPathname = '/admin/insights-fake';
    render(<AdminShell>content</AdminShell>);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    const insights = screen.getByRole('link', { name: /insights llm/i });
    expect(accueil).not.toHaveAttribute('data-active');
    expect(insights).not.toHaveAttribute('data-active');
  });

  it('renders a divider before the "Retour à l\'app" link', () => {
    const { container } = render(<AdminShell>content</AdminShell>);
    const hrs = container.querySelectorAll('hr');
    expect(hrs.length).toBeGreaterThan(0);
    const retour = screen.getByRole('link', { name: /retour à l['’]app/i });
    // The last hr should appear before the retour link in DOM order
    const lastHr = hrs[hrs.length - 1]!;
    const pos = lastHr.compareDocumentPosition(retour);
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(pos & 4).toBeTruthy();
  });
});
