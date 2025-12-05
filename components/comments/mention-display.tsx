/**
 * MentionDisplay Component
 *
 * Renders comment content with markdown formatting and mentions as chips/badges.
 * Parses mention markup and replaces with visual formatting.
 * Handles deleted users by showing "[Removed User]".
 */

'use client';

import * as React from 'react';
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

// Token regex for matching mention placeholders
const MENTION_TOKEN_REGEX = /\{\{MENTION:([^:]+):(\d+)\}\}/g;

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
  // Using {{MENTION:userId:index}} format to avoid markdown interpretation
  let processedContent = content;
  const mentionMap = new Map<string, { user: User | undefined; displayName: string; userId: string; isDeleted: boolean }>();

  // Replace mentions with unique tokens (in reverse order to preserve indices)
  [...mentions].reverse().forEach((mention) => {
    const user = mentionedUsers[mention.userId];
    const token = `{{MENTION:${mention.userId}:${mention.startIndex}}}`;
    mentionMap.set(token, {
      user,
      displayName: user?.name || mention.displayName,
      userId: mention.userId,
      isDeleted: !user,
    });
    processedContent = processedContent.substring(0, mention.startIndex) + token + processedContent.substring(mention.endIndex);
  });

  /**
   * Process a string value, replacing mention tokens with MentionChip components
   */
  const processText = (value: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex state
    MENTION_TOKEN_REGEX.lastIndex = 0;

    while ((match = MENTION_TOKEN_REGEX.exec(value)) !== null) {
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
            key={`mention-${match.index}-${match[1]}`}
            userId={mentionData.userId}
            displayName={mentionData.displayName}
            email={mentionData.user?.email}
            isDeleted={mentionData.isDeleted}
          />
        );
      } else {
        // Token not found in map, keep original text
        parts.push(token);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(value.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : value;
  };

  /**
   * Recursively process React children to find and replace mention tokens in text nodes
   */
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      // Handle string children - process for mentions
      if (typeof child === 'string') {
        return processText(child);
      }

      // Handle React elements - recursively process their children
      if (React.isValidElement(child)) {
        const childProps = child.props as { children?: React.ReactNode };
        if (childProps.children) {
          return React.cloneElement(child, {
            ...childProps,
            children: processChildren(childProps.children),
          } as React.Attributes);
        }
      }

      // Return other nodes as-is
      return child;
    });
  };

  const components: Components = {
    p: ({ children }) => (
      <span className="whitespace-pre-wrap block">
        {processChildren(children)}
      </span>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-zinc-100">
        {processChildren(children)}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic">
        {processChildren(children)}
      </em>
    ),
    a: ({ href, children }) => (
      <a
        className="text-blue-400 hover:text-blue-300 underline"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {processChildren(children)}
      </a>
    ),
    code: ({ children, className }) => {
      const inline = !className;
      return inline ? (
        <code className="bg-surface0 px-1.5 py-0.5 rounded text-sm text-mauve font-mono">
          {processChildren(children)}
        </code>
      ) : (
        <code className="block bg-surface0 rounded p-2 text-sm text-mauve font-mono overflow-x-auto my-2">
          {processChildren(children)}
        </code>
      );
    },
    ul: ({ children }) => <ul className="list-disc ml-4 my-2">{processChildren(children)}</ul>,
    ol: ({ children }) => <ol className="list-decimal ml-4 my-2">{processChildren(children)}</ol>,
    li: ({ children }) => (
      <li className="mb-1">
        {processChildren(children)}
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-surface0 pl-3 italic text-subtext0 my-2">
        {processChildren(children)}
      </blockquote>
    ),
    h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{processChildren(children)}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2">{processChildren(children)}</h2>,
    h3: ({ children }) => <h3 className="text-base font-bold mt-2 mb-1">{processChildren(children)}</h3>,
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
        @{displayName}
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
