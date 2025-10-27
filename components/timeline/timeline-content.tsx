/**
 * Timeline Content Component
 * Feature: 065-915-conversations-je
 *
 * Content wrapper for timeline items
 */

interface TimelineContentProps {
  children: React.ReactNode;
}

/**
 * Content wrapper for timeline items
 *
 * Provides flexible container for event content (comment boxes or event text)
 * Uses flex-1 to fill available space and min-w-0 to handle text overflow
 *
 * @example
 * <TimelineContent>
 *   <CommentBox content={comment.content} />
 * </TimelineContent>
 *
 * <TimelineContent>
 *   <span>Specification generation started</span>
 * </TimelineContent>
 */
export function TimelineContent({ children }: TimelineContentProps) {
  return <div className="flex-1 min-w-0">{children}</div>;
}
