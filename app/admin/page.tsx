import { notFound, redirect } from 'next/navigation';
import {
  AdminAccessDenied,
  requireAdmin,
} from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminRootPage(): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAccessDenied) {
      notFound();
    }
    throw error;
  }
  redirect('/admin/insights');
}
