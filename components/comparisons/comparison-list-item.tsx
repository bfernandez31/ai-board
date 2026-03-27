'use client';

import { Trophy, Users, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ComparisonListItemProps {
  comparison: {
    id: number;
    generatedAt: string;
    sourceTicketKey: string;
    sourceTicketTitle: string;
    winnerTicketKey: string;
    winnerTicketTitle: string;
    winnerScore: number;
    participantCount: number;
    participantTicketKeys: string[];
    summary: string;
    keyDifferentiators: string[];
  };
  isSelected: boolean;
  onClick: () => void;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ComparisonListItem({ comparison, isSelected, onClick }: ComparisonListItemProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'border-primary bg-accent/30'
      )}
      onClick={onClick}
      data-testid={`comparison-item-${comparison.id}`}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
              <span className="font-semibold text-sm">{comparison.winnerTicketKey}</span>
              <span className="text-sm text-muted-foreground truncate">
                {comparison.winnerTicketTitle}
              </span>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">{comparison.summary}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {comparison.participantCount} tickets ({comparison.participantTicketKeys.join(', ')})
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(comparison.generatedAt)}
              </span>
            </div>

            {comparison.keyDifferentiators.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {comparison.keyDifferentiators.slice(0, 4).map((diff) => (
                  <Badge key={diff} variant="secondary" className="text-xs">
                    {diff}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:ml-4">
            <div className="text-right">
              <div className="text-2xl font-bold">{comparison.winnerScore}%</div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
