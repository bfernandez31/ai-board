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

import { adminNotFoundResponse } from '@/app/lib/auth/admin';
import { GET as homeGet } from '@/app/api/admin/home/route';

function snapshot(res: Response): {
  status: number;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  for (const [name, value] of res.headers.entries()) {
    headers[name.toLowerCase()] = value;
  }
  return { status: res.status, headers };
}

describe('GET /api/admin/home — 404 parity for non-admin callers (SC-002)', () => {
  beforeEach(() => {
    requireAdminOrNotFoundMock.mockReset();
  });

  it('returns byte-equivalent 404 (status, body bytes, headers) for non-admins', async () => {
    const control = adminNotFoundResponse();
    const controlSnap = snapshot(control);
    const controlBody = await control.text();
    expect(controlSnap.status).toBe(404);
    expect(controlBody).toBe('');

    requireAdminOrNotFoundMock.mockResolvedValue({
      ok: false,
      response: adminNotFoundResponse(),
    });

    const res = await homeGet(new NextRequest('http://localhost/api/admin/home'));
    expect(snapshot(res)).toEqual(controlSnap);
    expect(await res.text()).toBe(controlBody);
  });
});
