/**
 * CommandAutocomplete Component
 *
 * Dropdown list of AI-BOARD commands for / autocomplete.
 * Shows command name and description.
 * Supports mouse and keyboard navigation.
 * Follows UserAutocomplete component pattern.
 */

'use client';

import { cn } from '@/lib/utils';
import type { AIBoardCommand } from '@/app/lib/data/ai-board-commands';

interface CommandAutocompleteProps {
  commands: AIBoardCommand[];
  onSelect: (command: AIBoardCommand) => void;
  selectedIndex: number;
}

export function CommandAutocomplete({
  commands,
  onSelect,
  selectedIndex,
}: CommandAutocompleteProps) {
  if (commands.length === 0) {
    return (
      <div
        data-testid="command-autocomplete"
        className="bg-popover border border-border rounded-md shadow-md p-2 max-h-[280px] overflow-y-auto"
        role="listbox"
        aria-label="Command autocomplete"
      >
        <div className="text-sm text-muted-foreground p-2 text-center">
          No commands available
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="command-autocomplete"
      className="bg-popover border border-border rounded-md shadow-md max-h-[280px] overflow-y-auto"
      role="listbox"
      aria-label="Command autocomplete"
    >
      {commands.map((command, index) => (
        <button
          key={command.name}
          type="button"
          data-testid="command-autocomplete-item"
          data-selected={index === selectedIndex}
          className={cn(
            'w-full text-left px-3 py-2 transition-colors focus:outline-none cursor-pointer',
            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            index === selectedIndex && 'bg-primary text-primary-foreground'
          )}
          onClick={() => onSelect(command)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <div className="flex flex-col">
            <span className="font-mono font-medium text-sm">{command.name}</span>
            <span
              className={cn(
                'text-xs',
                index === selectedIndex
                  ? 'text-primary-foreground/80'
                  : 'text-muted-foreground'
              )}
            >
              {command.description}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
