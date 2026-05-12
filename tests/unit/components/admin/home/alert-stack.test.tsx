import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { AlertStack } from '@/components/admin/home/alert-stack';
import type { Alert } from '@/lib/admin/home/types';

describe('AlertStack', () => {
  it('renders nothing when alerts array is empty', () => {
    const { container } = render(<AlertStack alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one banner per alert', () => {
    const alerts: Alert[] = [
      { kind: 'LOW_SUCCESS_RATE', message: 'Job success rate 78%', href: '/admin/insights' },
      { kind: 'STRIPE_WEBHOOK_ERRORS', message: 'Stripe errors detected', href: '/admin' },
    ];
    render(<AlertStack alerts={alerts} />);
    expect(screen.getByText('Job success rate 78%')).toBeTruthy();
    expect(screen.getByText('Stripe errors detected')).toBeTruthy();
  });

  it('renders an action link per alert with correct href', () => {
    const alerts: Alert[] = [
      { kind: 'STALE_CRITICAL_CRON', message: 'Cron stale', href: '/admin/insights' },
    ];
    render(<AlertStack alerts={alerts} />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/admin/insights')).toBe(true);
  });

  it('renders banners in the same order as input', () => {
    const alerts: Alert[] = [
      { kind: 'LOW_SUCCESS_RATE', message: 'First alert', href: '/a' },
      { kind: 'STRIPE_WEBHOOK_ERRORS', message: 'Second alert', href: '/b' },
      { kind: 'STALE_CRITICAL_CRON', message: 'Third alert', href: '/c' },
    ];
    render(<AlertStack alerts={alerts} />);
    const messages = screen
      .getAllByRole('alert')
      .map((el) => el.textContent ?? '');
    expect(messages[0]).toContain('First alert');
    expect(messages[1]).toContain('Second alert');
    expect(messages[2]).toContain('Third alert');
  });
});
