import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/app/lib/auth/admin';
import { computeDashboardSnapshot } from '@/app/lib/admin/home/dashboard-snapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;

  try {
    const snapshot = await computeDashboardSnapshot();
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(
      { error: 'Failed to compute dashboard snapshot', code: 'SNAPSHOT_FAILED' },
      { status: 500 }
    );
  }
}
