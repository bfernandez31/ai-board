'use client';

import { SignupsTrend } from './signups-trend';
import { JobsTrend } from './jobs-trend';
import { MrrTrend } from './mrr-trend';
import { Card, CardContent } from '@/components/ui/card';
import type { TrendsSnapshot } from '@/lib/admin/home/types';

interface TrendsRowProps {
  trends: TrendsSnapshot;
}

export function TrendsRow({ trends }: TrendsRowProps) {
  return (
    <section aria-label="Tendances">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Tendances
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Signups / day (30d)
            </h3>
            <SignupsTrend data={trends.signupsDaily} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Jobs / day (30d)
            </h3>
            <JobsTrend data={trends.jobsDaily} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              MRR / month (12m)
            </h3>
            <MrrTrend data={trends.mrrMonthly} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
