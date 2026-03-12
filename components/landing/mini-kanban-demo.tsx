/**
 * Mini Kanban Demo Component
 * Animated demo of 6-stage workflow for landing page
 * Includes icon legend explaining user interaction points
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { Eye, BotMessageSquare, BotOff, Bot } from 'lucide-react';
import { WorkflowColumnCard } from './workflow-column-card';
import { useAnimationState } from '@/lib/hooks/use-animation-state';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';
import {
  DEMO_TICKETS,
  WORKFLOW_STAGES,
  type DemoTicket,
  type WorkflowStage,
} from '@/lib/utils/animation-helpers';

export interface MiniKanbanDemoProps {
  className?: string;
  animationInterval?: number;
  autoStart?: boolean;
}

/**
 * Mini Kanban demo component with automatic ticket progression
 *
 * @param className - Additional CSS classes
 * @param animationInterval - Time between progressions (default: 4000ms)
 * @param autoStart - Whether to start animation immediately (default: true)
 */
export function MiniKanbanDemo({
  className = '',
  animationInterval = 4000,
  autoStart = true,
}: MiniKanbanDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef, { threshold: 0.1 });

  const {
    tickets,
    prefersReducedMotion,
    setVisible,
  } = useAnimationState(DEMO_TICKETS, autoStart ? animationInterval : 0);

  // Update visibility state when intersection changes
  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible, setVisible]);

  // Group tickets by column
  const ticketsByColumn = React.useMemo(() => {
    const grouped: Record<number, DemoTicket[]> = {};
    for (let i = 0; i <= 5; i++) {
      grouped[i] = [];
    }
    tickets.forEach((ticket) => {
      const column = grouped[ticket.column];
      if (column) {
        column.push(ticket);
      }
    });
    return grouped;
  }, [tickets]);

  return (
    <div
      ref={containerRef}
      className={`mini-kanban-demo ${className}`}
      data-visible={isVisible}
      data-reduced-motion={prefersReducedMotion}
    >
      {/* Mobile/Tablet: 2-3 columns, Desktop: 6 columns */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        {WORKFLOW_STAGES.map((stage: WorkflowStage) => (
          <WorkflowColumnCard
            key={stage.index}
            stage={stage}
            tickets={ticketsByColumn[stage.index] || []}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>

      {/* Icon Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 px-4 py-6 bg-card/50 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <BotOff className="w-5 h-5 text-ctp-red" strokeWidth={2} />
          <span className="text-sm text-foreground font-medium">No AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-ctp-blue" strokeWidth={2} />
          <span className="text-sm text-foreground font-medium">Review option</span>
        </div>
        <div className="flex items-center gap-2">
          <BotMessageSquare className="w-5 h-5 text-primary" strokeWidth={2} />
          <span className="text-sm text-foreground font-medium">Chat assistance</span>
        </div>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-ctp-green" strokeWidth={2} />
          <span className="text-sm text-foreground font-medium">AI automation</span>
        </div>
      </div>
    </div>
  );
}
