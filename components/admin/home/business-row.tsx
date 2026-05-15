'use client';

import { PlanDonut } from './plan-donut';
import { ActivationFunnelChart } from './activation-funnel';
import { ChurnPanel } from './churn-panel';
import { SectionPanel } from './section-panel';
import type { BusinessSnapshot } from '@/lib/admin/home/types';

interface BusinessRowProps {
  business: BusinessSnapshot;
}

export function BusinessRow({ business }: BusinessRowProps) {
  return (
    <section aria-label="Santé Business">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Santé Business
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SectionPanel title="Plan distribution">
          <PlanDonut data={business.planDistribution} />
        </SectionPanel>
        <SectionPanel title="30-day activation funnel">
          <ActivationFunnelChart data={business.activationFunnel} />
        </SectionPanel>
        <SectionPanel title="Churn this month">
          <ChurnPanel data={business.churn} />
        </SectionPanel>
      </div>
    </section>
  );
}
