import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { ProfileInfo, type ProfileData } from '@/components/settings/profile-info';

const baseProfile: ProfileData = {
  name: 'John Doe',
  email: 'john@example.com',
  image: 'https://avatars.githubusercontent.com/u/12345',
  createdAt: '2026-01-15T10:30:00.000Z',
  githubUsername: 'johndoe',
  githubUrl: 'https://github.com/johndoe',
  plan: 'FREE',
};

describe('ProfileInfo', () => {
  it('should render all profile fields', () => {
    render(<ProfileInfo profile={baseProfile} />);

    expect(screen.getByTestId('profile-name')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('profile-email')).toHaveTextContent('john@example.com');
    expect(screen.getByTestId('profile-github')).toHaveTextContent('johndoe');
    expect(screen.getByTestId('profile-date')).toBeInTheDocument();
    expect(screen.getByTestId('profile-plan')).toHaveTextContent('Free');
  });

  it('should render GitHub link with external URL', () => {
    render(<ProfileInfo profile={baseProfile} />);

    const githubLink = screen.getByTestId('profile-github');
    expect(githubLink.closest('a')).toHaveAttribute('href', 'https://github.com/johndoe');
    expect(githubLink.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('should show email as display name when name is null', () => {
    render(<ProfileInfo profile={{ ...baseProfile, name: null }} />);

    expect(screen.getByTestId('profile-name')).toHaveTextContent('john@example.com');
  });

  it('should show initials fallback when avatar image is null', () => {
    render(<ProfileInfo profile={{ ...baseProfile, image: null }} />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should show ?? fallback when both name and image are null', () => {
    render(<ProfileInfo profile={{ ...baseProfile, name: null, image: null }} />);

    expect(screen.getByText('??')).toBeInTheDocument();
  });

  it('should show "Not available" when GitHub username is null', () => {
    render(<ProfileInfo profile={{ ...baseProfile, githubUsername: null, githubUrl: null }} />);

    expect(screen.getByTestId('profile-github')).toHaveTextContent('Not available');
  });

  it('should display plan badge with billing link', () => {
    render(<ProfileInfo profile={{ ...baseProfile, plan: 'PRO' }} />);

    expect(screen.getByTestId('profile-plan')).toHaveTextContent('Pro');
    expect(screen.getByText('Manage billing')).toHaveAttribute('href', '/settings/billing');
  });

  it('should display TEAM plan correctly', () => {
    render(<ProfileInfo profile={{ ...baseProfile, plan: 'TEAM' }} />);

    expect(screen.getByTestId('profile-plan')).toHaveTextContent('Team');
  });
});
