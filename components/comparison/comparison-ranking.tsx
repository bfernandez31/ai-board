'use client';

import { Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ComparisonEntryData } from './types';

interface ComparisonRankingProps {
  entries: ComparisonEntryData[];
}

export function ComparisonRanking({ entries }: ComparisonRankingProps) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((entry) => (
        <Card
          key={entry.id}
          className={entry.isWinner ? 'border-green-500' : ''}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                #{entry.rank}
              </CardTitle>
              <div className="flex items-center gap-2">
                {entry.isWinner && (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                    <Crown className="h-3 w-3 mr-1" />
                    Winner
                  </Badge>
                )}
                <Badge variant="outline">
                  Score: {entry.score}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {entry.ticket ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  {entry.ticket.ticketKey}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {entry.ticket.title}
                </p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {entry.ticket.stage}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Ticket unavailable
              </p>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">Quality Score</p>
              {entry.qualityScore ? (
                <p className="text-sm font-medium text-foreground">
                  {entry.qualityScore.score}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Pending</p>
              )}
            </div>

            {entry.keyDifferentiators && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Key Differentiators</p>
                <p className="text-sm text-foreground">
                  {entry.keyDifferentiators}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
