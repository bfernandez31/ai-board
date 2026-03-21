'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonSectionProps } from './types';

const metricRows = [
  { key: 'linesChanged', label: 'Lines changed' },
  { key: 'filesChanged', label: 'Files changed' },
  { key: 'testFilesChanged', label: 'Test files changed' },
] as const;

function formatMetric(value: number | null) {
  return value == null ? 'Unavailable' : value.toLocaleString();
}

export function ComparisonMetricsGrid({ participants }: ComparisonSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Implementation Metrics</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 min-w-[180px] bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {participants.map((participant) => (
                <th
                  key={participant.ticketId}
                  className="min-w-[140px] px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {participant.ticketKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                  {row.label}
                </td>
                {participants.map((participant) => {
                  const value = participant.metrics[row.key];
                  const isBest = participant.metrics.bestValueFlags[row.key] === true;

                  return (
                    <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{formatMetric(value)}</span>
                        {isBest && <Badge variant="secondary">Best value</Badge>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
