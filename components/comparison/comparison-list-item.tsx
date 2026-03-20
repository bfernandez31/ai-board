'use client';

import { Trophy, Users, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ComparisonListItem } from './types';

interface ComparisonListItemProps {
  item: ComparisonListItem;
  onClick: () => void;
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ComparisonListItemCard({ item, onClick }: ComparisonListItemProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">
                {item.sourceTicketKey}
              </span>
              {item.ticketIsWinner && (
                <Trophy className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {item.recommendation}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {item.winnerTicketKey && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Winner</p>
                <p className="text-sm font-medium text-foreground">
                  {item.winnerTicketKey}
                  {item.winnerScore != null && (
                    <span className="text-muted-foreground ml-1">
                      ({item.winnerScore})
                    </span>
                  )}
                </p>
              </div>
            )}

            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {item.entryCount}
            </Badge>

            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(item.createdAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
