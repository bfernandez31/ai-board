/**
 * RTL Component Tests: AdminSidebar (AIB-799)
 *
 * Verifies the admin shell sidebar:
 *  - Renders the "Espace admin" label and the V1 item list (Accueil + Insights LLM)
 *  - Marks the item matching the current pathname as active (aria-current="page")
 *  - "Insights LLM" matches as prefix (active on /admin/insights subroutes)
 *  - "Accueil" matches exactly (active only on /admin)
 *  - Renders a "Retour à l'app" link pointing to /
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname: string | null = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { AdminSidebar } from '@/components/admin/admin-sidebar';

describe('AdminSidebar', () => {
  it('renders the "Espace admin" label and both V1 nav items', () => {
    mockPathname = '/admin';
    render(<AdminSidebar />);

    expect(screen.getByText('Espace admin')).toBeInTheDocument();

    const accueil = screen.getByRole('link', { name: /accueil/i });
    expect(accueil).toHaveAttribute('href', '/admin');

    const insights = screen.getByRole('link', { name: /insights llm/i });
    expect(insights).toHaveAttribute('href', '/admin/insights');
  });

  it('renders a "Retour à l\'app" link pointing to /', () => {
    mockPathname = '/admin/insights';
    render(<AdminSidebar />);

    const back = screen.getByTestId('admin-sidebar-back-to-app');
    expect(back).toHaveAttribute('href', '/');
    expect(back).toHaveTextContent(/retour à l'app/i);
  });

  it('marks the Accueil item active when on /admin exactly', () => {
    mockPathname = '/admin';
    render(<AdminSidebar />);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    const insights = screen.getByRole('link', { name: /insights llm/i });

    expect(accueil).toHaveAttribute('aria-current', 'page');
    expect(insights).not.toHaveAttribute('aria-current');
  });

  it('marks the Insights LLM item active when on /admin/insights', () => {
    mockPathname = '/admin/insights';
    render(<AdminSidebar />);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    const insights = screen.getByRole('link', { name: /insights llm/i });

    expect(insights).toHaveAttribute('aria-current', 'page');
    expect(accueil).not.toHaveAttribute('aria-current');
  });

  it('marks Insights LLM active on a deeper /admin/insights/* sub-path (prefix match)', () => {
    mockPathname = '/admin/insights/run-42';
    render(<AdminSidebar />);

    const insights = screen.getByRole('link', { name: /insights llm/i });
    expect(insights).toHaveAttribute('aria-current', 'page');
  });

  it('does NOT mark Accueil active when on /admin/insights (exact match, no prefix)', () => {
    mockPathname = '/admin/insights';
    render(<AdminSidebar />);

    const accueil = screen.getByRole('link', { name: /accueil/i });
    expect(accueil).not.toHaveAttribute('aria-current');
  });
});
