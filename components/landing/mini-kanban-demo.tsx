'use client';

import { useEffect, useRef } from 'react';
import { useAnimationState } from '@/lib/hooks/use-animation-state';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';
import {
  DEMO_TICKETS,
  WORKFLOW_STAGES,
  type DemoTicket,
  type WorkflowStage,
} from '@/lib/utils/animation-helpers';
import { WORKFLOW_HIGHLIGHTS } from '@/components/landing/content';
import { WorkflowColumnCard } from './workflow-column-card';

export interface MiniKanbanDemoProps {
  className?: string;
  animationInterval?: number;
  autoStart?: boolean;
}

function createEmptyTicketColumns(): Record<number, DemoTicket[]> {
  return WORKFLOW_STAGES.reduce<Record<number, DemoTicket[]>>((grouped, stage) => {
    grouped[stage.index] = [];
    return grouped;
  }, {});
}

function groupTicketsByColumn(tickets: DemoTicket[]): Record<number, DemoTicket[]> {
  const grouped = createEmptyTicketColumns();

  tickets.forEach((ticket) => {
    grouped[ticket.column]?.push(ticket);
  });

  return grouped;
}

export function MiniKanbanDemo({
  className = '',
  animationInterval = 4000,
  autoStart = true,
}: MiniKanbanDemoProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef, { threshold: 0.1 });

  const { tickets, prefersReducedMotion, setVisible } = useAnimationState(
    DEMO_TICKETS,
    autoStart ? animationInterval : 0
  );

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible, setVisible]);

  const ticketsByColumn = groupTicketsByColumn(tickets);

  return (
    <div
      ref={containerRef}
      className={`mini-kanban-demo ${className}`}
      data-visible={isVisible}
      data-reduced-motion={prefersReducedMotion}
    >
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {WORKFLOW_STAGES.map((stage: WorkflowStage) => (
          <WorkflowColumnCard
            key={stage.index}
            stage={stage}
            tickets={ticketsByColumn[stage.index] ?? []}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card/50 px-4 py-6 md:grid-cols-3">
        {WORKFLOW_HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 text-primary" strokeWidth={2} />
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
