'use client';

import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from './score-gauge';
import { getParticipantColor } from './participant-colors';
import type { ComparisonParticipantGridProps } from './types';

export function ComparisonParticipantGrid({
  participants,
}: ComparisonParticipantGridProps) {
  if (participants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4">
      {participants.map((participant) => {
        const color = getParticipantColor(participant.rank);

        return (
          <div
            key={participant.ticketId}
            className={`flex min-w-[200px] flex-1 items-start gap-3 rounded-xl border p-5 ${color.border} ${color.bgSubtle}`}
          >
            <ScoreGauge
              score={participant.score}
              size={40}
              strokeWidth={3}
              animated={false}
              strokeColor={color.stroke}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${color.bgMedium} ${color.text}`}>
                  #{participant.rank}
                </span>
                <span className="font-semibold text-foreground">{participant.ticketKey}</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{participant.title}</div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
                  {participant.rankRationale}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
