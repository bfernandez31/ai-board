'use client';

import { SignupsTrend } from './signups-trend';
import { JobsTrend } from './jobs-trend';
import { MrrTrend } from './mrr-trend';
import { SectionPanel } from './section-panel';
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
        <SectionPanel title="Signups / day (30d)">
          <SignupsTrend data={trends.signupsDaily} />
        </SectionPanel>
        <SectionPanel title="Jobs / day (30d)">
          <JobsTrend data={trends.jobsDaily} />
        </SectionPanel>
        <SectionPanel title="MRR / month (12m)">
          <MrrTrend data={trends.mrrMonthly} />
        </SectionPanel>
      </div>
    </section>
  );
}
