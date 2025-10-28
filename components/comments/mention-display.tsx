/**
 * MentionDisplay Component
 *
 * Renders comment content with markdown formatting and mentions as chips/badges.
 * Parses mention markup and replaces with visual formatting.
 * Handles deleted users by showing "[Removed User]".
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
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
 * Render comment content with markdown and mentions formatted as chips
 *
 * Parses mention markup (@[userId:displayName]) and replaces with:
 * - Visual badge/chip for existing users
 * - "[Removed User]" text for deleted users
 * Also renders markdown syntax (bold, italic, links, etc.)
 */
export function MentionDisplay({ content, mentionedUsers }: MentionDisplayProps) {
  const mentions = parseMentions(content);

  // Replace mentions with placeholder tokens that won't be affected by markdown parsing
  let processedContent = content;
  const mentionMap = new Map<string, { user: User | undefined; displayName: string; userId: string; isDeleted: boolean }>();

  // Replace mentions with unique tokens (in reverse order to preserve indices)
  [...mentions].reverse().forEach((mention) => {
    const user = mentionedUsers[mention.userId];
    const token = `__MENTION_${mention.userId}_${mention.startIndex}__`;
    mentionMap.set(token, {
      user,
      displayName: user?.name || mention.displayName,
      userId: mention.userId,
      isDeleted: !user,
    });
    processedContent = processedContent.substring(0, mention.startIndex) + token + processedContent.substring(mention.endIndex);
  });

  // Text component that handles mention tokens
  const TextWithMentions = ({ value }: { value: string }) => {
    const mentionTokenRegex = /__MENTION_([^_]+)_(\d+)__/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionTokenRegex.exec(value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(value.substring(lastIndex, match.index));
      }

      // Add mention chip
      const token = match[0];
      const mentionData = mentionMap.get(token);
      if (mentionData) {
        parts.push(
          <MentionChip
            key={`mention-${match.index}`}
            userId={mentionData.userId}
            displayName={mentionData.displayName}
            email={mentionData.user?.email}
            isDeleted={mentionData.isDeleted}
          />
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(value.substring(lastIndex));
    }

    return <>{parts.length > 0 ? parts : value}</>;
  };

  const components: Components = {
    p: ({ children }) => (
      <span className="whitespace-pre-wrap block">
        {typeof children === 'string' ? <TextWithMentions value={children} /> : children}
      </span>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-zinc-100">
        {typeof children === 'string' ? <TextWithMentions value={children} /> : children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic">
        {typeof children === 'string' ? <TextWithMentions value={children} /> : children}
      </em>
    ),
    a: ({ href, children }) => (
      <a
        className="text-blue-400 hover:text-blue-300 underline"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {typeof children === 'string' ? <TextWithMentions value={children} /> : children}
      </a>
    ),
    code: ({ children, className }) => {
      const inline = !className;
      const text = String(children);
      return inline ? (
        <code className="bg-surface0 px-1.5 py-0.5 rounded text-sm text-mauve font-mono">
          {text}
        </code>
      ) : (
        <code className="block bg-surface0 rounded p-2 text-sm text-mauve font-mono overflow-x-auto my-2">
          {text}
        </code>
      );
    },
    ul: ({ children }) => <ul className="list-disc ml-4 my-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal ml-4 my-2">{children}</ol>,
    li: ({ children }) => (
      <li className="mb-1">
        {typeof children === 'string' ? <TextWithMentions value={children} /> : children}
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-surface0 pl-3 italic text-subtext0 my-2">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className="markdown-content">
      <ReactMarkdown components={components}>{processedContent}</ReactMarkdown>
    </div>
  );
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
