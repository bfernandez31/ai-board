/**
 * UserAutocomplete Component
 *
 * Dropdown list of project members for mention autocomplete.
 * Supports mouse and keyboard navigation.
 */

'use client';

import { ProjectMember } from '@/app/lib/types/mention';
import { cn } from '@/lib/utils';

interface UserAutocompleteProps {
  users: ProjectMember[];
  onSelect: (user: ProjectMember) => void;
  selectedIndex: number;
}

export function UserAutocomplete({
  users,
  onSelect,
  selectedIndex,
}: UserAutocompleteProps) {
  if (users.length === 0) {
    return (
      <div
        data-testid="mention-autocomplete"
        className="bg-popover border border-border rounded-md shadow-md p-2 max-h-[200px] overflow-y-auto"
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
      className="bg-popover border border-border rounded-md shadow-md max-h-[200px] overflow-y-auto"
      role="listbox"
      aria-label="User autocomplete"
    >
      {users.map((user, index) => (
        <button
          key={user.id}
          type="button"
          data-testid="mention-user-item"
          data-selected={index === selectedIndex}
          className={cn(
            'w-full text-left px-3 py-2 cursor-pointer transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:bg-accent focus:text-accent-foreground focus:outline-none',
            index === selectedIndex && 'bg-accent text-accent-foreground'
          )}
          onClick={() => onSelect(user)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {user.name || user.email}
            </span>
            {user.name && (
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
