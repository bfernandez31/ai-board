'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getComplianceTheme } from './comparison-theme';
import type { ComparisonComplianceHeatmapProps } from './types';

export function ComparisonComplianceHeatmap({
  rows,
  participants,
}: ComparisonComplianceHeatmapProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No compliance data available for this comparison.
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  Principle
                </th>
                {participants.map((p) => (
                  <th key={p.ticketId} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {p.ticketKey}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.principleKey} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                    {row.principleName}
                  </td>
                  {participants.map((p) => {
                    const assessment = row.assessments.find(
                      (a) => a.participantTicketId === p.ticketId
                    );

                    if (!assessment) {
                      return (
                        <td key={p.ticketId} className="px-3 py-2">
                          <div
                            data-testid="heatmap-cell"
                            className="h-8 w-full rounded bg-muted"
                          />
                        </td>
                      );
                    }

                    const label =
                      assessment.status === 'pass'
                        ? 'Pass'
                        : assessment.status === 'mixed'
                          ? 'Mixed'
                          : assessment.status === 'fail'
                            ? 'Fail'
                            : 'N/A';

                    return (
                      <td key={p.ticketId} className="px-3 py-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              data-testid="heatmap-cell"
                              className={cn(
                                'flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border text-[11px] font-semibold uppercase tracking-[0.22em]',
                                getComplianceTheme(assessment.status)
                              )}
                            >
                              {label}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs text-sm">{assessment.notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
