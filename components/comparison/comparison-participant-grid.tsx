'use client';

import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from './score-gauge';
import type { ComparisonParticipantGridProps } from './types';

export function ComparisonParticipantGrid({
  participants,
}: ComparisonParticipantGridProps) {
  if (participants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {participants.map((participant) => (
        <div
          key={participant.ticketId}
          className="flex min-w-[200px] flex-1 items-start gap-3 rounded-lg border border-border bg-card p-4"
        >
          <ScoreGauge score={participant.score} size={40} strokeWidth={3} animated={false} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground">#{participant.rank}</span>
              <span className="font-semibold text-foreground">{participant.ticketKey}</span>
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">{participant.title}</div>

            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                {participant.workflowType}
              </Badge>
              {participant.agent && (
                <Badge variant="outline" className="text-xs">
                  {participant.agent}
                </Badge>
              )}
              {participant.quality.state === 'available' && participant.quality.value != null && (
                <Badge variant="secondary" className="text-xs">
                  {participant.quality.value}
                </Badge>
              )}
            </div>

            {participant.rankRationale && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {participant.rankRationale}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
