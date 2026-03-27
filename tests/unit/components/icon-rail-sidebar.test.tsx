/**
 * RTL Component Tests: IconRailSidebar
 *
 * Tests for the icon rail sidebar navigation component.
 * Verifies rendering of navigation icons, active state, tooltips, and layout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock pathname - MUST be before component import
let mockPathname = '/projects/1/board';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// Import component AFTER mocks
import { IconRailSidebar } from '@/components/navigation/icon-rail-sidebar';

function renderSidebar() {
  return render(
    <TooltipProvider>
      <IconRailSidebar projectId={1} />
    </TooltipProvider>
  );
}

describe('IconRailSidebar', () => {
  beforeEach(() => {
    mockPathname = '/projects/1/board';
  });

  it('renders 5 navigation icons with correct labels', () => {
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: 'Project navigation' });
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);

    expect(links[0]).toHaveAttribute('href', '/projects/1/board');
    expect(links[1]).toHaveAttribute('href', '/projects/1/activity');
    expect(links[2]).toHaveAttribute('href', '/projects/1/analytics');
    expect(links[3]).toHaveAttribute('href', '/projects/1/comparisons');
    expect(links[4]).toHaveAttribute('href', '/projects/1/settings');
  });

  it('highlights active icon based on pathname for board', () => {
    mockPathname = '/projects/1/board';
    renderSidebar();

    const boardLink = screen.getByRole('link', { name: /board/i });
    expect(boardLink).toHaveAttribute('aria-current', 'page');

    const activityLink = screen.getByRole('link', { name: /activity/i });
    expect(activityLink).not.toHaveAttribute('aria-current');
  });

  it('highlights active icon based on pathname for analytics', () => {
    mockPathname = '/projects/1/analytics';
    renderSidebar();

    const analyticsLink = screen.getByRole('link', { name: /analytics/i });
    expect(analyticsLink).toHaveAttribute('aria-current', 'page');

    const boardLink = screen.getByRole('link', { name: /board/i });
    expect(boardLink).not.toHaveAttribute('aria-current');
  });

  it('displays tooltips on hover', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const boardLink = screen.getByRole('link', { name: /board/i });
    await user.hover(boardLink);

    // Tooltip content should appear
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Board');
  });

  it('renders settings icon separated at bottom via border-t', () => {
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: 'Project navigation' });
    // The nav should have justify-between to push settings to bottom
    expect(nav.className).toContain('justify-between');

    // Settings link should be in a container with border-t
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    const bottomGroup = settingsLink.closest('div');
    expect(bottomGroup?.className).toContain('border-t');
  });

  it('has hidden lg:flex class for responsive visibility', () => {
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: 'Project navigation' });
    expect(nav.className).toContain('hidden');
    expect(nav.className).toContain('lg:flex');
  });
});
