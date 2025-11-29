'use client';

import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Analytics will appear once you have completed workflow jobs with telemetry data. Create
          and run some tickets to see cost trends, token usage, and more.
        </p>
      </CardContent>
    </Card>
  );
}
