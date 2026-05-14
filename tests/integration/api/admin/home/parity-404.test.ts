import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { requireAdminOrNotFoundMock } = vi.hoisted(() => ({
  requireAdminOrNotFoundMock: vi.fn(),
}));

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    requireAdminOrNotFound: requireAdminOrNotFoundMock,
  };
});

vi.mock('@/lib/admin/home/snapshot', () => ({
  buildSnapshot: vi.fn(),
}));

import { adminNotFoundResponse } from '@/app/lib/auth/admin';
import { GET } from '@/app/api/admin/home/route';

function snapshot(res: Response): { status: number; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  for (const [name, value] of res.headers.entries()) {
    headers[name.toLowerCase()] = value;
  }
  return { status: res.status, headers };
}

describe('Admin-route 404 parity for non-admin callers (home endpoint)', () => {
  beforeEach(() => {
    requireAdminOrNotFoundMock.mockReset();
  });

  it('non-admin GET /api/admin/home returns byte-equivalent 404', async () => {
    const control = adminNotFoundResponse();
    const controlSnap = snapshot(control);
    const controlBody = await control.text();
    expect(controlSnap.status).toBe(404);
    expect(controlBody).toBe('');

    requireAdminOrNotFoundMock.mockResolvedValue({
      ok: false,
      response: adminNotFoundResponse(),
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    expect(snapshot(res)).toEqual(controlSnap);
    expect(await res.text()).toBe(controlBody);
  });

  it('unauthenticated GET returns byte-equivalent 404', async () => {
    const control = adminNotFoundResponse();
    const controlSnap = snapshot(control);
    const controlBody = await control.text();

    requireAdminOrNotFoundMock.mockResolvedValue({
      ok: false,
      response: adminNotFoundResponse(),
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/home'));
    expect(snapshot(res)).toEqual(controlSnap);
    expect(await res.text()).toBe(controlBody);
  });
});
