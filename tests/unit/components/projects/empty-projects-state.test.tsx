/**
 * EmptyProjectsState Component Tests
 *
 * Tests for the EmptyProjectsState component which displays
 * when a user has no projects.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/render-helpers';
import { EmptyProjectsState } from '@/components/projects/empty-projects-state';

describe('EmptyProjectsState', () => {
  describe('rendering', () => {
    it('displays empty state title', () => {
      renderWithProviders(<EmptyProjectsState />);

      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    it('displays empty state description', () => {
      renderWithProviders(<EmptyProjectsState />);

      expect(
        screen.getByText(/get started by creating a new project/i)
      ).toBeInTheDocument();
    });

    it('renders Import Project button (disabled)', () => {
      renderWithProviders(<EmptyProjectsState />);

      const importButton = screen.getByRole('button', { name: /import project/i });
      expect(importButton).toBeInTheDocument();
      expect(importButton).toBeDisabled();
    });

    it('renders Create Project button (disabled)', () => {
      renderWithProviders(<EmptyProjectsState />);

      const createButton = screen.getByRole('button', { name: /create project/i });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toBeDisabled();
    });
  });
});
