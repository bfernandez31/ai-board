/**
 * Demo Ticket Card Component
 * Displays individual ticket card in the mini-Kanban demo
 * Matches actual board ticket card dark theme styling
 * Shows workflow icons indicating user actions required
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, BotMessageSquare, BotOff, Bot } from 'lucide-react';
import type { DemoTicket } from '@/lib/utils/animation-helpers';

export interface DemoTicketCardProps {
  ticket: DemoTicket;
  isAnimating?: boolean;
  prefersReducedMotion?: boolean;
}

// Icon configuration per stage (column index)
const STAGE_ICONS: Record<number, { icon: React.ElementType; label: string }[]> = {
  0: [{ icon: BotOff, label: 'No AI on this step' }], // INBOX
  1: [
    { icon: Eye, label: 'Review required' },
    { icon: BotMessageSquare, label: 'Chat assistance available' },
    { icon: Bot, label: 'AI automation' },
  ], // SPECIFY
  2: [
    { icon: Eye, label: 'Review required' },
    { icon: BotMessageSquare, label: 'Chat assistance available' },
    { icon: Bot, label: 'AI automation' },
  ], // PLAN
  3: [
    { icon: BotMessageSquare, label: 'Chat assistance available' },
    { icon: Bot, label: 'AI automation' },
  ], // BUILD
  4: [
    { icon: Eye, label: 'Review required' },
    { icon: BotMessageSquare, label: 'Chat assistance available' },
    { icon: Bot, label: 'AI automation' },
  ], // VERIFY
  5: [], // SHIP - no icons
};

/**
 * Demo ticket card matching actual board dark theme styling
 *
 * @param ticket - Ticket data to display
 * @param isAnimating - True during column transition
 * @param prefersReducedMotion - True if user prefers reduced motion
 */
export function DemoTicketCard({
  ticket,
  isAnimating = false,
  prefersReducedMotion = false,
}: DemoTicketCardProps) {
  const icons = STAGE_ICONS[ticket.column] || [];

  return (
    <Card
      className={`
        demo-ticket
        bg-[#181825]
        border-[#313244]
        p-4
        transition-all
        hover:border-[#45475a]
        hover:bg-[#1e1e2e]
        overflow-hidden
        shadow-sm
        cursor-grab
        active:cursor-grabbing
        ${prefersReducedMotion ? 'duration-300' : 'duration-200'}
      `}
      data-ticket-id={ticket.id}
      data-column={ticket.column}
      data-animating={isAnimating}
      role="article"
      aria-label={`Demo ticket: ${ticket.title}`}
    >
      {/* Header: ID and Badge */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-[#a6adc8] font-mono font-semibold">
          #{ticket.id}
        </span>
        <Badge className="bg-[#89b4fa]/20 text-[#89b4fa] border-[#89b4fa]/50 hover:bg-[#89b4fa]/30 text-xs px-2 py-0.5 font-semibold">
          SONNET
        </Badge>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm line-clamp-2 text-[#cdd6f4] break-all overflow-hidden mb-3">
        {ticket.title}
      </h3>

      {/* Workflow Icons */}
      {icons.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#313244]">
          {icons.map((iconConfig, index) => {
            const IconComponent = iconConfig.icon;
            return (
              <IconComponent
                key={index}
                className="w-4 h-4 text-[#8B5CF6]"
                strokeWidth={2}
                aria-label={iconConfig.label}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
