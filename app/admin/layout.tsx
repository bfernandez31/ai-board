import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { requireAdminPageOrNotFound } from '@/app/lib/auth/admin';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

/**
 * Admin shell layout. Calls notFound() for any caller who is not in
 * `ADMIN_ALLOWLIST`, producing the byte-equivalent 404 a non-existent route
 * would yield (AIB-791 FR-003, D-10). The global Header from the root layout
 * stays visible.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  // Reconstitute a minimal NextRequest-like shape: the underlying session
  // resolver only reads `headers`, but we pass `nextUrl`/`url` too so the
  // x-test-user-id override path behaves the same as in API routes.
  const requestLike = {
    headers: requestHeaders,
    nextUrl: { pathname: '/admin' },
    url: '/admin',
  } as unknown as NextRequest;

  await requireAdminPageOrNotFound(requestLike);

  return <AdminShell>{children}</AdminShell>;
}
