import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /admin → /admin/insights. The layout already enforces admin allowlist
 * with notFound() on failure (AIB-791 FR-003); reaching this redirect means
 * the caller is allowlisted.
 */
export default function AdminRootPage(): never {
  redirect('/admin/insights');
}
