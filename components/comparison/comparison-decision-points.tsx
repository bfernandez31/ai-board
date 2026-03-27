'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAccentColorByRank } from '@/lib/comparison/accent-colors';
import type { ComparisonDecisionPointsProps, ComparisonDecisionPointsEnhancedProps } from './types';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';

function resolveAccent(
  verdictTicketId: number,
  winnerTicketId: number,
  participants?: ComparisonParticipantDetail[]
) {
  const participant = participants?.find((p) => p.ticketId === verdictTicketId);
  return getAccentColorByRank(participant?.rank ?? (verdictTicketId === winnerTicketId ? 1 : 2));
}

function VerdictDot({
  verdictTicketId,
  winnerTicketId,
  participants,
}: {
  verdictTicketId: number | null;
  winnerTicketId: number;
  participants?: ComparisonParticipantDetail[] | undefined;
}) {
  if (verdictTicketId === null) {
    return (
      <div
        data-testid="verdict-dot-neutral"
        className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30"
      />
    );
  }

  const accent = resolveAccent(verdictTicketId, winnerTicketId, participants);

  return (
    <div
      data-testid="verdict-dot-glow"
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${verdictTicketId === winnerTicketId ? 'bg-ctp-green' : 'bg-ctp-yellow'} ${accent.shadow}`}
    />
  );
}

export function ComparisonDecisionPoints(
  props: ComparisonDecisionPointsProps | ComparisonDecisionPointsEnhancedProps
) {
  const { decisionPoints } = props;
  const winnerTicketId = 'winnerTicketId' in props ? props.winnerTicketId : null;
  const participants = 'participants' in props ? props.participants : undefined;

  return (
    <Card
      className="border-ctp-mauve/15 aurora-bg-subtle"
    >
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-ctp-subtext0">
          Decision Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {decisionPoints.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No saved decision points for this comparison.
          </div>
        )}
        {decisionPoints.map((point) => {
          const verdictAccent = point.verdictTicketId != null && winnerTicketId != null
            ? resolveAccent(point.verdictTicketId, winnerTicketId, participants)
            : null;

          return (
            <Collapsible key={point.id} defaultOpen={point.displayOrder === 0}>
              <div
                data-testid="decision-point-card"
                className="rounded-lg border border-ctp-mauve/15 aurora-bg-decision"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <div className="flex items-start gap-2">
                    {winnerTicketId != null && (
                      <div className="mt-1.5">
                        <VerdictDot
                          verdictTicketId={point.verdictTicketId}
                          winnerTicketId={winnerTicketId}
                          participants={participants}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{point.title}</span>
                        {verdictAccent && point.verdictTicketId != null && (
                          <span
                            data-testid="verdict-pill"
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${verdictAccent.bgMedium} ${verdictAccent.text}`}
                          >
                            {participants?.find((p) => p.ticketId === point.verdictTicketId)?.ticketKey ?? (point.verdictTicketId === winnerTicketId ? 'Winner' : 'Other')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {point.verdictSummary}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent
                  className="border-t border-ctp-mauve/10 px-4 py-3"
                >
                  <p className="text-sm text-muted-foreground">{point.rationale}</p>
                  {point.participantApproaches.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {point.participantApproaches.map((approach) => (
                        <div key={approach.ticketId}>
                          <div className="text-sm font-medium text-foreground">
                            <Badge variant="outline" className="mr-2 border-ctp-mauve/20">
                              {approach.ticketKey}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {approach.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">
                      No saved participant approaches for this decision point.
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
