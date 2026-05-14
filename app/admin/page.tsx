import { type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { requireAdminPageOrNotFound } from '@/app/lib/auth/admin';
import { buildSnapshot } from '@/lib/admin/home/snapshot';
import { AdminHomePage } from '@/components/admin/home/admin-home-page';

export const dynamic = 'force-dynamic';

export default async function AdminRootPage() {
  const requestHeaders = await headers();
  const requestLike = {
    headers: requestHeaders,
    nextUrl: { pathname: '/admin' },
    url: '/admin',
  } as unknown as NextRequest;

  await requireAdminPageOrNotFound(requestLike);

  const snapshot = await buildSnapshot();

  return <AdminHomePage initialData={snapshot} />;
}
