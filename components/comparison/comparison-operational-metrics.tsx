'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildOperationalMetricRows } from '@/lib/comparison/operational-metrics';
import { ComparisonQualityPopover } from './comparison-quality-popover';
import type { ComparisonOperationalMetricsGridProps, OperationalMetricCell } from './types';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function CellContent({
  cell,
  isQualityRow,
  participant,
}: {
  cell: OperationalMetricCell;
  isQualityRow?: boolean | undefined;
  participant?: ComparisonParticipantDetail | undefined;
}) {
  if (cell.state === 'pending') {
    return <span className="text-muted-foreground">Pending</span>;
  }

  if (cell.state === 'unavailable' || cell.formattedValue == null) {
    return <span className="text-muted-foreground">N/A</span>;
  }

  const showPopover = isQualityRow && participant?.qualityDetails != null;

  return (
    <div className="flex items-center gap-2">
      {showPopover ? (
        <ComparisonQualityPopover
          qualityDetails={participant!.qualityDetails}
          qualityScore={cell.value}
        />
      ) : (
        <span>{cell.formattedValue}</span>
      )}
      {cell.isBest && <Badge variant="secondary">Best</Badge>}
    </div>
  );
}

export function ComparisonOperationalMetricsGrid({
  participants,
}: ComparisonOperationalMetricsGridProps) {
  const rows = buildOperationalMetricRows(participants);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
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
                  <div>{participant.ticketKey}</div>
                  <div className="text-xs font-normal">
                    {participant.workflowType}
                    {participant.agent ? ` · ${participant.agent}` : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.definition.key}
                className="border-b border-border last:border-0"
              >
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                  {row.definition.label}
                </td>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cell.ticketId}
                    className="px-3 py-2 text-foreground"
                  >
                    <CellContent
                      cell={cell}
                      isQualityRow={row.definition.key === 'qualityScore'}
                      participant={participants[cellIndex]}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
