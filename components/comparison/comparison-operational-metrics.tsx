'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonDashboardMetricRow } from '@/lib/types/comparison';
import { ComparisonQualityPopover } from './comparison-quality-popover';
import type { OperationalMetricsProps } from './types';

function getQualityLabel(score: number | null): string {
  if (score == null) {
    return 'Unavailable';
  }

  if (score >= 90) {
    return `${score} Excellent`;
  }
  if (score >= 70) {
    return `${score} Good`;
  }
  if (score >= 50) {
    return `${score} Fair`;
  }
  return `${score} Poor`;
}

function formatFallbackMetricValue(
  state: ComparisonDashboardMetricRow['cells'][number]['state'],
  value: number | null
): string {
  if (state === 'available' && value != null) {
    return value.toLocaleString();
  }

  if (state === 'pending') {
    return 'Pending';
  }

  return 'Unavailable';
}

function getFallbackRows({
  participants,
}: OperationalMetricsProps): ComparisonDashboardMetricRow[] {
  return [
    {
      key: 'totalTokens',
      label: 'Total Tokens',
      category: 'detail',
      bestDirection: 'lowest',
      cells: participants.map((participant) => ({
        ticketId: participant.ticketId,
        ticketKey: participant.ticketKey,
        state: participant.telemetry.totalTokens.state,
        value: participant.telemetry.totalTokens.value,
        displayValue: formatFallbackMetricValue(
          participant.telemetry.totalTokens.state,
          participant.telemetry.totalTokens.value
        ),
        isBest: false,
        isWinner: participant.isWinner,
        supportsPopover: false,
      })),
    },
  ];
}

export function ComparisonOperationalMetrics({
  participants,
  metricRows,
}: OperationalMetricsProps) {
  const rows =
    metricRows && metricRows.length > 0
      ? metricRows
      : getFallbackRows({ participants });
  const participantsByTicketId = new Map(
    participants.map((participant) => [participant.ticketId, participant])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relative Metrics Matrix</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {participants.map((participant) => (
                <th
                  key={participant.ticketId}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {participant.ticketKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.category}-${row.key}`}
                className="border-b border-border last:border-0"
              >
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                  {row.label}
                </td>
                {row.cells.map((cell) => {
                  const participant = participantsByTicketId.get(cell.ticketId);

                  return (
                    <td
                      key={cell.ticketId}
                      className="px-3 py-2 align-top text-foreground"
                    >
                      <div className="flex min-w-[140px] flex-col gap-2">
                        {cell.supportsPopover && participant ? (
                          <ComparisonQualityPopover
                            qualityBreakdown={participant.qualityBreakdown}
                            qualityScore={participant.quality}
                            formattedScore={getQualityLabel(cell.value)}
                          />
                        ) : (
                          <span>{cell.displayValue}</span>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {cell.isWinner ? (
                            <Badge variant="outline">Winner</Badge>
                          ) : null}
                          {cell.isBest ? (
                            <Badge variant="secondary">Best</Badge>
                          ) : null}
                          {cell.state !== 'available' ? (
                            <Badge variant="outline">{cell.state}</Badge>
                          ) : null}
                        </div>
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
