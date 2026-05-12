import { computeDashboardSnapshot } from '@/app/lib/admin/home/dashboard-snapshot';
import { AdminHomeDashboard } from '@/components/admin/home/admin-home-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const snapshot = await computeDashboardSnapshot();
  return <AdminHomeDashboard initialData={snapshot} />;
}
