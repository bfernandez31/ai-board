import { notFound } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await verifyAdminAccess();
  } catch {
    notFound();
  }

  return (
    <div className="flex h-full min-h-0">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
