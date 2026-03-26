'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComparisonComplianceGridProps } from './types';

function getStatusLabel(status: 'pass' | 'mixed' | 'fail' | 'missing') {
  if (status === 'pass') return 'Pass';
  if (status === 'mixed') return 'Mixed';
  if (status === 'fail') return 'Fail';
  return 'Missing';
}

function getStatusClasses(status: 'pass' | 'mixed' | 'fail' | 'missing') {
  if (status === 'pass') {
    return 'border-primary/30 bg-primary/10 text-foreground';
  }
  if (status === 'fail') {
    return 'border-destructive/30 bg-destructive/10 text-foreground';
  }
  if (status === 'mixed') {
    return 'border-accent bg-accent/60 text-foreground';
  }
  return 'border-border bg-muted text-muted-foreground';
}

export function ComparisonComplianceGrid({
  rows,
  participants,
}: ComparisonComplianceGridProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Constitution Compliance</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Principle
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
              <tr key={row.principleKey} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">
                  {row.principleName}
                </td>
                {participants.map((participant) => {
                  const assessment = row.assessments.find(
                    (entry) => entry.participantTicketId === participant.ticketId
                  );

                  return (
                    <td key={participant.ticketId} className="px-3 py-2 align-top">
                      {assessment ? (
                        <div className="space-y-2">
                          <Badge
                            variant="outline"
                            className={cn(getStatusClasses(assessment.status))}
                          >
                            {getStatusLabel(assessment.status)}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {assessment.notes}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unavailable</span>
                      )}
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
