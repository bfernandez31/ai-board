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

describe('Global header — no admin link for non-admins (AIB-791 FR-001 / AIB-796 FR-002)', () => {
  it('does not render any link or button referencing /admin when unauthenticated', () => {
    sessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { container } = renderWithProviders(<Header isAdmin={false} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/\/admin/);
  });

  it('does not render any link or button referencing /admin when authenticated non-admin', () => {
    sessionMock.mockReturnValue({
      data: { user: { email: 'user@e2e.local', name: 'A' } },
      status: 'authenticated',
    });
    const { container } = renderWithProviders(<Header isAdmin={false} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/\/admin/);
  });
});
