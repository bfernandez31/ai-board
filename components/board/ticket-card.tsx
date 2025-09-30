'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp } from '@/lib/utils/time';
import { getStageConfig } from '@/lib/utils/stage';
import type { TicketCardProps } from '@/lib/types';

/**
 * TicketCard Component (Client Component)
 * Displays individual ticket information with hover/click feedback
 * - Title (truncated at 2 lines)
 * - Ticket ID (format: #123)
 * - Stage badge
 * - Last updated timestamp
 */
export function TicketCard({ ticket }: TicketCardProps) {
  const stageConfig = getStageConfig(ticket.stage);

  return (
    <Card
      className="p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      role="article"
      aria-label={`Ticket ${ticket.id}: ${ticket.title}`}
    >
      {/* Ticket ID */}
      <div className="text-xs text-muted-foreground mb-2">#{ticket.id}</div>

      {/* Title - truncated at 2 lines */}
      <h3 className="font-medium text-sm mb-3 line-clamp-2" title={ticket.title}>
        {ticket.title}
      </h3>

      {/* Footer: Badge and Timestamp */}
      <div className="flex items-center justify-between text-xs">
        <Badge
          variant="outline"
          className={`${stageConfig.borderColor} ${stageConfig.textColor}`}
          aria-label={`Status: ${stageConfig.label}`}
        >
          {stageConfig.label}
        </Badge>

        <time
          dateTime={ticket.updatedAt.toISOString()}
          className="text-muted-foreground"
        >
          {formatTimestamp(ticket.updatedAt)}
        </time>
      </div>
    </Card>
  );
}