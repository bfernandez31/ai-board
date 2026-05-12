import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/tests/utils/component-test-utils';
import { Header } from '@/components/layout/header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/projects/1',
  useRouter: () => ({ push: vi.fn() }),
}));

const sessionMock = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => sessionMock(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

/**
 * AIB-791 FR-001 originally forbade ANY `/admin` link in the global header.
 * AIB-799 supersedes that: an admin entry now appears inside the user-menu
 * dropdown, but ONLY for `session.user.isAdmin` and ONLY once the dropdown
 * is opened (Radix portals the content out on demand). The header at rest —
 * before any interaction — must still render no `/admin` reference for
 * unauthenticated visitors or for non-admin authenticated users.
 */
describe('Global header — no admin link at rest (AIB-791 FR-001 / AIB-799)', () => {
  it('does not render any link or button referencing /admin when unauthenticated', () => {
    sessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { container } = renderWithProviders(<Header />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/\/admin/);
  });

  it('does not render /admin in the closed header for a non-admin authenticated user', () => {
    sessionMock.mockReturnValue({
      data: { user: { email: 'user@e2e.local', name: 'A', isAdmin: false } },
      status: 'authenticated',
    });
    const { container } = renderWithProviders(<Header />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/\/admin/);
  });
});
