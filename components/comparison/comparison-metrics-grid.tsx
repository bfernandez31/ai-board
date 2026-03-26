'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonSectionProps } from './types';

function formatMetric(value: number | null) {
  return value == null ? 'Unavailable' : value.toLocaleString();
}

export function ComparisonMetricsGrid({ participants }: ComparisonSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headline Metric Comparison</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Metric</th>
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
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-medium text-foreground">Files Changed</td>
              {participants.map((participant) => (
                <td key={participant.ticketId} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{formatMetric(participant.metrics.filesChanged)}</span>
                    {participant.metrics.bestValueFlags.filesChanged ? (
                      <Badge variant="secondary">Best</Badge>
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-medium text-foreground">Cost</td>
              {participants.map((participant) => (
                <td key={participant.ticketId} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>
                      {participant.telemetry.costUsd.state === 'available' &&
                      participant.telemetry.costUsd.value != null
                        ? `$${participant.telemetry.costUsd.value.toFixed(2)}`
                        : participant.telemetry.costUsd.state === 'pending'
                          ? 'Pending'
                          : 'Unavailable'}
                    </span>
                    {participant.isWinner ? <Badge variant="outline">Winner</Badge> : null}
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-medium text-foreground">Duration</td>
              {participants.map((participant) => (
                <td key={participant.ticketId} className="px-3 py-2">
                  <span>
                    {participant.telemetry.durationMs.state === 'available' &&
                    participant.telemetry.durationMs.value != null
                      ? `${Math.floor(participant.telemetry.durationMs.value / 60000)}m ${Math.round((participant.telemetry.durationMs.value % 60000) / 1000)}s`
                      : participant.telemetry.durationMs.state === 'pending'
                        ? 'Pending'
                        : 'Unavailable'}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-foreground">Quality Score</td>
              {participants.map((participant) => (
                <td key={participant.ticketId} className="px-3 py-2">
                  <span>
                    {participant.quality.state === 'available' && participant.quality.value != null
                      ? participant.quality.value
                      : participant.quality.state === 'pending'
                        ? 'Pending'
                        : 'Unavailable'}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
