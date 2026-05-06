'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdoptionData } from '@/lib/calibration/types';

interface AdoptionCounterProps {
  adoption: AdoptionData;
}

function formatRatio(ratio: number | null): string {
  if (ratio === null) return 'n/a';
  return `${(ratio * 100).toFixed(1)}%`;
}

export function AdoptionCounter({ adoption }: AdoptionCounterProps) {
  const { analyzed, sinceFeatureAvailable, ratio } = adoption;

  if (sinceFeatureAvailable === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            Analysis adoption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No tickets since feature became available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">
          Analysis adoption
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-3xl font-semibold text-foreground">
              {formatRatio(ratio)}
            </p>
            <p className="text-xs text-muted-foreground">
              {`${analyzed} of ${sinceFeatureAvailable} tickets analysed since feature available`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
