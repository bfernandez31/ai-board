/**
 * Timeline Badge Component
 * Feature: 065-915-conversations-je
 *
 * Wrapper for timeline item badges (avatars or event icons)
 */

import { cn } from '@/lib/utils';

interface TimelineBadgeProps {
  variant?: 'avatar' | 'event';
  children: React.ReactNode;
}

/**
 * Badge wrapper for timeline items
 *
 * - avatar variant: Minimal wrapper for user avatars (comment events)
 * - event variant: Circular badge with border for system events (job events)
 *
 * @example
 * <TimelineBadge variant="avatar">
 *   <Avatar user={comment.user} />
 * </TimelineBadge>
 *
 * <TimelineBadge variant="event">
 *   <PlayCircle className="w-4 h-4 text-blue" />
 * </TimelineBadge>
 */
export function TimelineBadge({ variant = 'avatar', children }: TimelineBadgeProps) {
  return (
    <div
      className={cn(
        'absolute left-0 flex-shrink-0',
        variant === 'event' &&
          'w-8 h-8 rounded-full bg-surface0 border-2 border-base flex items-center justify-center'
      )}
    >
      {children}
    </div>
  );
}
