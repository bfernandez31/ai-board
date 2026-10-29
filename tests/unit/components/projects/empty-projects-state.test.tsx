/**
 * Component Tests: EmptyProjectsState
 *
 * Verifies the import/create actions are hidden when project creation is
 * closed to the viewer (PROJECT_CREATION_DISABLED).
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

// ImportProjectModal (rendered closed) needs the app router and next-auth
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

import { renderWithProviders } from '@/tests/utils/component-test-utils';
import { EmptyProjectsState } from '@/components/projects/empty-projects-state';

describe('EmptyProjectsState', () => {
  it('shows the import and create actions when creation is allowed', () => {
    renderWithProviders(<EmptyProjectsState canCreateProjects />);

    expect(screen.getByRole('button', { name: /Import Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Project/i })).toBeInTheDocument();
    expect(screen.queryByText(/invite-only/i)).not.toBeInTheDocument();
  });

  it('hides the actions and explains why when creation is closed', () => {
    renderWithProviders(<EmptyProjectsState canCreateProjects={false} />);

    expect(screen.getByText('Project creation is currently invite-only.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import Project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Project/i })).not.toBeInTheDocument();
  });
});
