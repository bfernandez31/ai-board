/**
 * Comment Timeline Item Component
 * Feature: 065-915-conversations-je
 *
 * Displays user comment in timeline with bordered box styling
 */

'use client';

import React from 'react';
import { Avatar } from '@/components/comments/avatar';
import { MentionDisplay } from '@/components/comments/mention-display';
import { TimelineBadge } from './timeline-badge';
import { TimelineContent } from './timeline-content';
import type { CommentWithUser } from '@/app/lib/types/comment';
import type { User } from '@/app/lib/types/mention';

interface CommentTimelineItemProps {
  comment: CommentWithUser;
  timestamp: string;
  mentionedUsers: Record<string, User>;
}

/**
 * Format timestamp to relative time
 * (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return then.toLocaleDateString();
  }
}

/**
 * Comment timeline item with bordered box design
 *
 * Displays:
 * - User avatar in badge
 * - Author name and timestamp
 * - Comment content with markdown-like styling
 *
 * Memoized for performance (prevents re-renders when other events update)
 */
export const CommentTimelineItem = React.memo(
  function CommentTimelineItem({ comment, timestamp, mentionedUsers }: CommentTimelineItemProps) {
    return (
      <li className="relative pl-12">
        <TimelineBadge variant="avatar">
          <Avatar name={comment.user.name} image={comment.user.image} />
        </TimelineBadge>
        <TimelineContent>
          {/* Speech bubble with tail pointing to avatar */}
          <div className="relative border border-surface0 rounded-lg bg-mantle p-4 shadow-sm">
            {/* Speech bubble tail (triangle pointing left) */}
            <div className="absolute -left-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-surface0 border-b-8 border-b-transparent" />
            <div className="absolute -left-[7px] top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-mantle border-b-8 border-b-transparent" />

            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-text">
                {comment.user.name || comment.user.email}
              </span>
              <time className="text-xs text-subtext0" dateTime={timestamp}>
                {formatRelativeTime(timestamp)}
              </time>
            </div>
            <div className="prose prose-sm prose-invert max-w-none">
              <MentionDisplay content={comment.content} mentionedUsers={mentionedUsers} />
            </div>
          </div>
        </TimelineContent>
      </li>
    );
  }
);
