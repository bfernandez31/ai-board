import { headers } from 'next/headers';
import Link from 'next/link';
import type { NextRequest } from 'next/server';
import { requireAdminPageOrNotFound } from '@/app/lib/auth/admin';

export const dynamic = 'force-dynamic';

/**
 * Admin shell layout (AIB-791). Calls notFound() for any caller who is not
 * in `ADMIN_ALLOWLIST`, producing the byte-equivalent 404 a non-existent
 * route would yield (FR-003, D-10). The global Header from the root layout
 * stays visible; FR-001 forbids adding an /admin link to it.
 *
 * The single sidebar entry today is "Insights".
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 shrink-0 border-r border-border bg-card/40 p-4">
        <nav className="flex flex-col gap-1">
          <Link
            href="/admin/insights"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Insights
          </Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
