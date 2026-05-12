import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// US2 / SC-002: every admin-route response to a non-admin caller MUST be
// byte-equivalent (status, body bytes, headers) to a genuine "missing route"
// response. We intercept the admin auth helper to deny the request and then
// hit each route handler directly. The control response is the documented
// shape Next.js produces for an unrouted API path (404, empty body,
// Content-Type: text/html; charset=utf-8) — that's what `adminNotFoundResponse`
// builds, so we compare against it.

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

import { GET as listGet } from '@/app/api/admin/insights/reports/route';
import { GET as singleGet } from '@/app/api/admin/insights/reports/[id]/route';
import { GET as htmlGet } from '@/app/api/admin/insights/reports/[id]/html/route';

function snapshot(res: Response): {
  status: number;
  headers: Record<string, string>;
} {
  // Full header equality is the actual contract — the comment above this
  // suite claims "byte-equivalent (status, body bytes, headers)", so capture
  // every header. Header names are lowercased (Fetch spec) before sorting so
  // ordering differences don't fail the equality check.
  const headers: Record<string, string> = {};
  for (const [name, value] of res.headers.entries()) {
    headers[name.toLowerCase()] = value;
  }
  return { status: res.status, headers };
}

describe('Admin-route 404 parity for non-admin callers (US2, SC-002)', () => {
  beforeEach(() => {
    requireAdminOrNotFoundMock.mockReset();
  });

  it('every admin GET path returns the same shape as a missing route', async () => {
    const control = adminNotFoundResponse();
    const controlSnap = snapshot(control);
    const controlBody = await control.text();
    expect(controlSnap.status).toBe(404);
    expect(controlBody).toBe('');

    // Deny on every call.
    requireAdminOrNotFoundMock.mockResolvedValue({
      ok: false,
      response: adminNotFoundResponse(),
    });

    const targets = [
      () =>
        listGet(new NextRequest('http://localhost/api/admin/insights/reports')),
      () =>
        singleGet(
          new NextRequest('http://localhost/api/admin/insights/reports/1'),
          { params: Promise.resolve({ id: '1' }) }
        ),
      () =>
        htmlGet(
          new NextRequest('http://localhost/api/admin/insights/reports/1/html'),
          { params: Promise.resolve({ id: '1' }) }
        ),
    ];

    for (const target of targets) {
      const res = await target();
      expect(snapshot(res)).toEqual(controlSnap);
      expect(await res.text()).toBe(controlBody);
    }
  });
});
