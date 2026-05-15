'use client';

import { PlanDonut } from './plan-donut';
import { ActivationFunnelChart } from './activation-funnel';
import { ChurnPanel } from './churn-panel';
import { Card, CardContent } from '@/components/ui/card';
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
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Plan distribution
            </h3>
            <PlanDonut data={business.planDistribution} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              30-day activation funnel
            </h3>
            <ActivationFunnelChart data={business.activationFunnel} />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Churn this month
            </h3>
            <ChurnPanel data={business.churn} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
