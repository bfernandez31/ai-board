/**
 * Component Tests: RepoPickerItem
 *
 * Tests repo row display, disabled states, and selection behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoPickerItem, type RepoPickerItemData } from '@/components/projects/repo-picker-item';

const baseRepo: RepoPickerItemData = {
  id: 123,
  name: 'my-app',
  fullName: 'octocat/my-app',
  owner: 'octocat',
  ownerAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  description: 'My awesome application',
  isPrivate: false,
  pushedAt: new Date().toISOString(),
  hasAdminAccess: true,
  isAlreadyImported: false,
  existingProjectId: null,
};

describe('RepoPickerItem', () => {
  it('shows repo name, description, and visibility (T019)', () => {
    render(<RepoPickerItem repo={baseRepo} onSelect={vi.fn()} />);

    expect(screen.getByText('octocat/my-app')).toBeInTheDocument();
    expect(screen.getByText('My awesome application')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<RepoPickerItem repo={baseRepo} onSelect={onSelect} />);

    await user.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(baseRepo);
  });

  it('shows private visibility indicator', () => {
    const privateRepo = { ...baseRepo, isPrivate: true };
    render(<RepoPickerItem repo={privateRepo} onSelect={vi.fn()} />);

    // Lock icon is rendered for private repos
    expect(screen.getByText('octocat/my-app')).toBeInTheDocument();
  });

  it('renders disabled when no admin access (T019)', () => {
    const noAdminRepo = { ...baseRepo, hasAdminAccess: false };
    render(<RepoPickerItem repo={noAdminRepo} onSelect={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onSelect when disabled (no admin)', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const noAdminRepo = { ...baseRepo, hasAdminAccess: false };

    render(<RepoPickerItem repo={noAdminRepo} onSelect={onSelect} />);

    await user.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders disabled when already imported (T027)', () => {
    const importedRepo = { ...baseRepo, isAlreadyImported: true, existingProjectId: 5 };
    render(<RepoPickerItem repo={importedRepo} onSelect={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onSelect when already imported', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const importedRepo = { ...baseRepo, isAlreadyImported: true };

    render(<RepoPickerItem repo={importedRepo} onSelect={onSelect} />);

    await user.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders without description when null', () => {
    const noDescRepo = { ...baseRepo, description: null };
    render(<RepoPickerItem repo={noDescRepo} onSelect={vi.fn()} />);

    expect(screen.getByText('octocat/my-app')).toBeInTheDocument();
  });

  it('shows "Never pushed" for null pushedAt', () => {
    const noPushRepo = { ...baseRepo, pushedAt: null };
    render(<RepoPickerItem repo={noPushRepo} onSelect={vi.fn()} />);

    expect(screen.getByText('Never pushed')).toBeInTheDocument();
  });
});
