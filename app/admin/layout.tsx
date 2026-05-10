import { notFound } from 'next/navigation';
import {
  AdminAccessDenied,
  requireAdmin,
} from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAccessDenied) {
      notFound();
    }
    throw error;
  }

  return <div className="min-h-screen">{children}</div>;
}
