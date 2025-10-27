/**
 * Timeline Layout Component
 * Feature: 065-915-conversations-je
 *
 * Provides vertical timeline structure with connector line
 * GitHub-inspired design for conversation events
 */

import { cn } from '@/lib/utils';

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Timeline layout wrapper with vertical connector line
 *
 * Renders as semantic <ol> element with ARIA label for accessibility
 * Includes vertical line connecting all timeline items
 *
 * @example
 * <Timeline>
 *   <TimelineItem>...</TimelineItem>
 *   <TimelineItem>...</TimelineItem>
 * </Timeline>
 */
export function Timeline({ children, className }: TimelineProps) {
  return (
    <ol
      className={cn('relative space-y-4', className)}
      aria-label="Timeline of ticket activity"
    >
      {/* Vertical connector line - centered on 32px badges at left: 16px (4rem) */}
      <div
        className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface0"
        aria-hidden="true"
      />
      {children}
    </ol>
  );
}
