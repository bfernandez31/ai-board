'use client';

import * as React from 'react';

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TicketWithVersion } from '@/lib/types';
import { QualityScoreBadge } from '@/components/ticket/quality-score-badge';
import { TicketCardAgentBadge } from './ticket-card-agent-badge';
import type { TicketCardSelection } from './ticket-card';

interface TicketCardHeaderProps {
  ticket: TicketWithVersion;
  qualityScore?: number | null | undefined;
  selection?: TicketCardSelection | undefined;
}

/**
 * Ticket Card Header
 *
 * Top row of a ticket card: optional bulk-select checkbox and the formatted
 * ticket key on the left; quality score, workflow-type badge and agent badge
 * on the right.
 */
export const TicketCardHeader = React.memo(
  ({ ticket, qualityScore, selection }: TicketCardHeaderProps) => {
    const dashIdx = ticket.ticketKey.indexOf('-');
    const keyPrefix = dashIdx >= 0 ? ticket.ticketKey.slice(0, dashIdx + 1) : ticket.ticketKey;
    const keyNumber = dashIdx >= 0 ? ticket.ticketKey.slice(dashIdx + 1) : '';

    return (
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {selection && (
            <span
              className={`inline-flex ${
                selection.isSelectMode || selection.isSelected
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              } transition-opacity`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                aria-label={`Select ticket ${ticket.ticketKey}`}
                data-testid="bulk-select-checkbox"
                checked={selection.isSelected}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.shiftKey) {
                    event.preventDefault();
                    selection.onRangeSelect();
                  }
                }}
                onCheckedChange={() => selection.onToggle()}
              />
            </span>
          )}
          <span
            className="font-mono text-[12px] tracking-[0.08em] leading-none"
            data-testid="ticket-key"
          >
            <span className="font-bold text-ctp-mauve">#</span>
            <span className="font-normal text-ctp-overlay0">{keyPrefix}</span>
            <span className="font-semibold text-ctp-mauve">{keyNumber}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <QualityScoreBadge score={qualityScore ?? null} compact />
          {ticket.workflowType === 'QUICK' && (
            <Badge
              variant="attribute-tc"
              kind="scope"
              scope="quick"
              className="shrink-0"
              data-testid="quick-badge"
            >
              QUICK
            </Badge>
          )}
          {ticket.workflowType === 'CLEAN' && (
            <Badge variant="secondary" className="shrink-0 inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Clean
            </Badge>
          )}
          {/* Agent Badge (with optional custom-models halo ring) */}
          <TicketCardAgentBadge ticket={ticket} />
        </div>
      </div>
    );
  }
);

TicketCardHeader.displayName = 'TicketCardHeader';
