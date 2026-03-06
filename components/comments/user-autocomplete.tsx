/**
 * UserAutocomplete Component
 *
 * Dropdown list of project members for mention autocomplete.
 * Supports mouse and keyboard navigation.
 * Shows AI-BOARD availability status with tooltips.
 */

'use client';

import { ProjectMember } from '@/app/lib/types/mention';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UserAutocompleteProps {
  users: ProjectMember[];
  onSelect: (user: ProjectMember) => void;
  selectedIndex: number;
  aiBoardUserId?: string;
  aiBoardAvailable?: boolean;
  aiBoardUnavailableReason?: string;
}

export function UserAutocomplete({
  users,
  onSelect,
  selectedIndex,
  aiBoardUserId,
  aiBoardAvailable = true,
  aiBoardUnavailableReason,
}: UserAutocompleteProps) {
  if (users.length === 0) {
    return (
      <div
        data-testid="mention-autocomplete"
        className="bg-popover border border-border rounded-md shadow-md p-2 max-h-[280px] overflow-y-auto"
        role="listbox"
      >
        <div className="text-sm text-muted-foreground p-2 text-center">
          No users found
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mention-autocomplete"
      className="bg-popover border border-border rounded-md shadow-md max-h-[280px] overflow-y-auto"
      role="listbox"
      aria-label="User autocomplete"
    >
      {users.map((user, index) => {
        const isAIBoard = aiBoardUserId && user.id === aiBoardUserId;
        const isUnavailable = isAIBoard && !aiBoardAvailable;

        const userButton = (
          <button
            key={user.id}
            type="button"
            data-testid="mention-user-item"
            data-selected={index === selectedIndex}
            data-ai-board={isAIBoard}
            data-unavailable={isUnavailable}
            className={cn(
              'w-full text-left px-3 py-2 transition-colors focus:outline-none',
              isUnavailable && 'cursor-not-allowed opacity-50',
              !isUnavailable && 'cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
              !isUnavailable && index === selectedIndex && 'bg-primary text-primary-foreground'
            )}
            onClick={() => !isUnavailable && onSelect(user)}
            disabled={isUnavailable ? true : undefined}
            role="option"
            aria-selected={index === selectedIndex}
            aria-disabled={isUnavailable ? true : undefined}
          >
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {user.name || user.email}
                {isAIBoard && ' 🤖'}
              </span>
              {user.name && (
                <span className={cn(
                  "text-xs",
                  index === selectedIndex && !isUnavailable
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}>
                  {user.email}
                </span>
              )}
            </div>
          </button>
        );

        // Wrap AI-BOARD with tooltip if unavailable
        if (isUnavailable && aiBoardUnavailableReason) {
          return (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>{userButton}</TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">{aiBoardUnavailableReason}</p>
              </TooltipContent>
            </Tooltip>
          );
        }

        return userButton;
      })}
    </div>
  );
}
