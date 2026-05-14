import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/app/lib/auth/admin';
import { buildSnapshot } from '@/lib/admin/home/snapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireAdminOrNotFound(request);
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await buildSnapshot();
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('GET /api/admin/home failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
