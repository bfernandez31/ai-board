'use client';

import { Badge } from '@/components/ui/badge';
import { getAccentColorByRank } from '@/lib/comparison/accent-colors';
import { ScoreGauge } from './score-gauge';
import { WorkflowTypeBadge, AgentTooltipIcon } from './workflow-agent-badges';
import type { ComparisonParticipantGridProps } from './types';

export function ComparisonParticipantGrid({
  participants,
}: ComparisonParticipantGridProps) {
  if (participants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {participants.map((participant) => {
        const accent = getAccentColorByRank(participant.rank);
        return (
          <div
            key={participant.ticketId}
            className="relative flex min-w-[200px] flex-1 items-start gap-3 rounded-lg border border-ctp-mauve/18 p-4 aurora-bg-participant"
          >
            {/* Agent + workflow badges in top-right */}
            <div className="absolute right-2 top-2 flex items-center gap-1.5">
              <AgentTooltipIcon agent={participant.agent} size={16} />
              <WorkflowTypeBadge workflowType={participant.workflowType} />
            </div>

            <ScoreGauge score={participant.score} size={40} strokeWidth={3} animated={false} accentColor={accent.hsl} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${accent.bgMedium} ${accent.text}`}>
                  {participant.rank}
                </span>
                <span className="font-semibold text-foreground">{participant.ticketKey}</span>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{participant.title}</div>

              {participant.quality.state === 'available' && participant.quality.value != null && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {participant.quality.value}
                  </Badge>
                </div>
              )}

              {participant.rankRationale && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
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
