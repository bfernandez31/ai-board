'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp } from '@/lib/utils/time';
import { Folder, Clock } from 'lucide-react';
import type { TicketCardProps } from '@/lib/types';

/**
 * TicketCard Component (Client Component)
 * Displays individual ticket information with hover/click feedback
 * - Ticket ID and title
 * - Stage badge (SONNET style)
 * - Directory path
 * - Last updated timestamp
 * - Messages/Tools metadata (placeholder for future)
 */
export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Card
      data-testid="ticket-card"
      className="bg-zinc-900 border-zinc-700 p-4 cursor-pointer transition-all hover:border-zinc-600 hover:bg-zinc-800 overflow-hidden"
      role="article"
      aria-label={`Ticket ${ticket.id}: ${ticket.title}`}
    >
      {/* Header: ID and Badge */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-zinc-400 font-mono font-semibold">#{ticket.id}</span>
        <Badge className="bg-blue-600 text-blue-50 border-blue-500 hover:bg-blue-700 text-xs px-2 py-0.5 font-semibold">
          SONNET
        </Badge>
      </div>

      {/* Title - truncated at 2 lines */}
      <h3 className="font-semibold text-sm mb-3 line-clamp-2 text-zinc-100 break-all overflow-hidden" title={ticket.title}>
        {ticket.title}
      </h3>

      {/* Directory Path */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2">
        <Folder className="w-3 h-3" />
        <span className="truncate font-medium">Directory: /ai-board</span>
      </div>

      {/* Last Updated */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-3">
        <Clock className="w-3 h-3" />
        <time dateTime={ticket.updatedAt.toISOString()} className="font-medium">
          Last updated: {formatTimestamp(ticket.updatedAt)}
        </time>
      </div>

      {/* Metadata: Messages/Tools Per Agent */}
      <div className="border-t border-zinc-700 pt-3">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
          MESSAGES/TOOLS PER AGENT
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-blue-300 font-semibold">PLAN</span>
            <span className="text-xs text-zinc-400 font-medium">0 · 0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-green-300 font-semibold">BUILD</span>
            <span className="text-xs text-zinc-400 font-medium">0 · 0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-orange-300 font-semibold">REVIEW</span>
            <span className="text-xs text-zinc-400 font-medium">0 · 0</span>
          </div>
        </div>
      </div>
    </Card>
  );
}