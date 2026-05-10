import { InsightsPageClient } from '@/components/admin/insights-page-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Insights | Admin | AI Board',
};

export default function AdminInsightsPage(): JSX.Element {
  return <InsightsPageClient />;
}
