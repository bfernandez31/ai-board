import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminOrNotFound } from '@/app/lib/auth/admin';
import { computePreflightSnapshot } from '@/app/lib/insights/preflight';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/insights/preflight — non-mutating UI check (AIB-791 US3).
 * Mirrors the trigger endpoint's pre-flight logic so the button can disable
 * itself and show a refusal message without firing a POST.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;

  const snapshot = await computePreflightSnapshot();
  return NextResponse.json(snapshot);
}
