'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecommendationPanelData } from '@/lib/calibration/types';

interface RecommendationPanelProps {
  data: RecommendationPanelData;
  windowSize: number;
}

function formatRate(rate: number | null): string {
  if (rate === null) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

export function RecommendationPanel({
  data,
  windowSize,
}: RecommendationPanelProps) {
  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">
          Recommendation calibration
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Two independent rates over the most recent {windowSize} pairs.
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">Matched rate</dt>
            <dd className="text-2xl font-semibold">
              {formatRate(data.matchedRate)}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground">
              {`${data.counts.matched} of ${windowSize} predicted choice equal to actual workflow`}
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">
              Friction-aligned rate
            </dt>
            <dd className="text-2xl font-semibold">
              {formatRate(data.frictionAlignedRate)}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground">
              {`${data.counts.frictionAligned} of ${windowSize} aligned with friction outcome`}
            </p>
          </div>
        </dl>

        <table
          role="table"
          className="mt-4 w-full text-sm"
          aria-label="Recommendation rates"
        >
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-2">
                Axis
              </th>
              <th scope="col" className="pb-2">
                Numerator
              </th>
              <th scope="col" className="pb-2">
                Denominator
              </th>
              <th scope="col" className="pb-2">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="py-1 font-normal">
                Matched
              </th>
              <td className="py-1">{data.counts.matched}</td>
              <td className="py-1">{windowSize}</td>
              <td className="py-1">{formatRate(data.matchedRate)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 font-normal">
                Friction-aligned
              </th>
              <td className="py-1">{data.counts.frictionAligned}</td>
              <td className="py-1">{windowSize}</td>
              <td className="py-1">{formatRate(data.frictionAlignedRate)}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
