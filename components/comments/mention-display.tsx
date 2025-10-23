/**
 * MentionDisplay Component
 *
 * Renders comment content with mentions formatted as chips/badges.
 * Parses mention markup and replaces with visual formatting.
 * Handles deleted users by showing "[Removed User]".
 */

'use client';

import { parseMentions } from '@/app/lib/utils/mention-parser';
import { User } from '@/app/lib/types/mention';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MentionDisplayProps {
  content: string;
  mentionedUsers: Record<string, User>;
}

/**
 * Render comment content with mentions formatted as chips
 *
 * Parses mention markup (@[userId:displayName]) and replaces with:
 * - Visual badge/chip for existing users
 * - "[Removed User]" text for deleted users
 */
export function MentionDisplay({ content, mentionedUsers }: MentionDisplayProps) {
  const mentions = parseMentions(content);

  // If no mentions, return plain text
  if (mentions.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Split content into segments (text + mentions)
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((mention, idx) => {
    // Text before mention
    if (mention.startIndex > lastIndex) {
      segments.push(
        <span key={`text-${idx}`} className="whitespace-pre-wrap">
          {content.substring(lastIndex, mention.startIndex)}
        </span>
      );
    }

    // Mention segment
    const user = mentionedUsers[mention.userId];
    const isDeleted = !user;

    segments.push(
      <MentionChip
        key={`mention-${idx}`}
        userId={mention.userId}
        displayName={user?.name || mention.displayName}
        email={user?.email}
        isDeleted={isDeleted}
      />
    );

    lastIndex = mention.endIndex;
  });

  // Remaining text
  if (lastIndex < content.length) {
    segments.push(
      <span key="text-end" className="whitespace-pre-wrap">
        {content.substring(lastIndex)}
      </span>
    );
  }

  return <>{segments}</>;
}

/**
 * Individual mention chip/badge component
 */
interface MentionChipProps {
  userId: string;
  displayName: string;
  email: string | undefined;
  isDeleted: boolean;
}

function MentionChip({ displayName, email, isDeleted }: MentionChipProps) {
  if (isDeleted) {
    return (
      <span
        data-testid="mention-chip"
        className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-sm bg-muted text-muted-foreground"
      >
        [Removed User]
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid="mention-chip"
            className={cn(
              'inline-block px-1.5 py-0.5 mx-0.5 rounded text-sm font-medium cursor-default',
              'bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
            )}
          >
            @{displayName}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col">
            <span className="font-medium">{displayName}</span>
            {email && (
              <span className="text-xs text-muted-foreground">{email}</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
