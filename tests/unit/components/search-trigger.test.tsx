/**
 * RTL Component Tests: SearchTrigger
 *
 * Tests for search trigger button rendering and behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchTrigger } from '@/components/navigation/search-trigger';

describe('SearchTrigger', () => {
  it('renders search icon and placeholder text', () => {
    render(<SearchTrigger onClick={vi.fn()} />);

    expect(screen.getByText('Search...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<SearchTrigger onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('displays keyboard shortcut badge', () => {
    render(<SearchTrigger onClick={vi.fn()} />);

    // Should have a kbd element with K
    const kbd = screen.getByText(/K/);
    expect(kbd).toBeInTheDocument();
    expect(kbd.tagName).toBe('KBD');
  });
});
