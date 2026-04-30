'use client';

import { Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CalibrationEmptyStateProps {
  totalRows: number;
  windowTarget?: number;
}

export function CalibrationEmptyState({
  totalRows,
  windowTarget = 30,
}: CalibrationEmptyStateProps) {
  return (
    <Card
      className="border-dashed aurora-bg-subtle"
      data-testid="calibration-warming-up"
    >
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Activity
          className="h-10 w-10 text-muted-foreground/50 mb-3"
          aria-hidden="true"
        />
        <h3 className="text-lg font-semibold mb-2">Still warming up</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {`${totalRows} of ${windowTarget} shipped+analyzed tickets paired so far.`}
        </p>
      </CardContent>
    </Card>
  );
}
