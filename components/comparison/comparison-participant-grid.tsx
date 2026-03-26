'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getParticipantTheme } from './comparison-theme';
import { ScoreGauge } from './score-gauge';
import type { ComparisonParticipantGridProps } from './types';

export function ComparisonParticipantGrid({
  participants,
}: ComparisonParticipantGridProps) {
  if (participants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {participants.map((participant) => (
        (() => {
          const theme = getParticipantTheme(participant.rank);
          return (
        <div
          key={participant.ticketId}
          data-testid={`participant-card-${participant.rank}`}
          className={cn(
            'flex min-w-[220px] flex-1 items-start gap-4 rounded-2xl border bg-ctp-mantle/75 p-5 shadow-lg backdrop-blur-sm',
            theme.border,
            theme.surface
          )}
        >
          <div className="rounded-2xl border border-white/10 bg-background/20 p-2">
            <ScoreGauge
              score={participant.score}
              size={48}
              strokeWidth={4}
              animated={false}
              theme={theme}
              gradientId={`participant-gauge-${participant.rank}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <Badge className={cn('rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.26em]', theme.pill)}>
                #{participant.rank}
              </Badge>
              <span className="font-semibold text-foreground">{participant.ticketKey}</span>
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">{participant.title}</div>

            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className={cn('text-xs', theme.border, theme.surface, theme.text)}>
                {participant.workflowType}
              </Badge>
              {participant.agent && (
                <Badge variant="outline" className={cn('text-xs', theme.border, theme.surface, theme.text)}>
                  {participant.agent}
                </Badge>
              )}
              {participant.quality.state === 'available' && participant.quality.value != null && (
                <Badge className={cn('text-xs', theme.pill)}>
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
          );
        })()
      ))}
    </div>
  );
}
