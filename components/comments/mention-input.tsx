/**
 * MentionInput Component
 *
 * Textarea with @ detection and autocomplete for user mentions,
 * # detection for ticket references, and / detection for commands.
 * Handles:
 * - @ symbol detection at word boundaries (user mentions)
 * - # symbol detection at word boundaries (ticket references)
 * - / symbol detection after @ai-board mention (commands)
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Mouse selection
 * - Insertion at cursor position
 * - Multiple autocomplete types support
 * - AI-BOARD availability status and tooltips
 */

'use client';

import { useState, useRef, useMemo, useCallback, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ProjectMember } from '@/app/lib/types/mention';
import { formatMention } from '@/app/lib/utils/mention-parser';
import { UserAutocomplete } from './user-autocomplete';
import { TicketAutocomplete } from './ticket-autocomplete';
import { CommandAutocomplete } from './command-autocomplete';
import { Textarea } from '@/components/ui/textarea';
import { useAIBoardAvailability } from '@/app/hooks/use-ai-board-availability';
import { useTicketSearch } from '@/app/lib/hooks/queries/useTicketSearch';
import { filterCommands, type AIBoardCommand } from '@/app/lib/data/ai-board-commands';
import type { SearchResult } from '@/app/lib/types/search';

type AutocompleteType = 'none' | 'mention' | 'ticket' | 'command';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  projectMembers: ProjectMember[];
  projectId: number;
  ticketId?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onAutocompleteOpenChange?: (isOpen: boolean) => void;
}

export function MentionInput({
  value,
  onChange,
  projectMembers,
  projectId,
  ticketId,
  placeholder = 'Add a comment...',
  className,
  disabled = false,
  onAutocompleteOpenChange,
}: MentionInputProps) {
  const [autocompleteType, setAutocompleteType] = useState<AutocompleteType>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAutocompleteOpen = autocompleteType !== 'none';

  // Find AI-BOARD user ID
  const aiBoardUser = useMemo(
    () => projectMembers.find((m) => m.email === 'ai-board@system.local'),
    [projectMembers]
  );

  // Check AI-BOARD availability
  const { data: availability } = useAIBoardAvailability(
    ticketId,
    Boolean(ticketId && aiBoardUser)
  );

  // Ticket search query - only enabled when autocomplete type is 'ticket' and query >= 2 chars
  const { data: ticketSearchData } = useTicketSearch(
    projectId,
    searchQuery,
  );

  // Get filtered tickets from search results
  const filteredTickets = useMemo(() => {
    if (autocompleteType !== 'ticket') return [];
    if (searchQuery.length < 2) return [];
    return ticketSearchData?.results ?? [];
  }, [autocompleteType, searchQuery, ticketSearchData]);

  // Get filtered commands
  const filteredCommands = useMemo(() => {
    if (autocompleteType !== 'command') return [];
    return filterCommands(searchQuery);
  }, [autocompleteType, searchQuery]);

  /**
   * Notify parent when autocomplete opens/closes
   */
  useEffect(() => {
    onAutocompleteOpenChange?.(isAutocompleteOpen);
  }, [isAutocompleteOpen, onAutocompleteOpenChange]);

  /**
   * Intercept Escape key at document level to prevent Dialog from closing
   * when autocomplete is open
   */
  useEffect(() => {
    const handleEscapeCapture = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isAutocompleteOpen) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setAutocompleteType('none');
      }
    };

    // Use capture phase to intercept before Dialog's listener
    document.addEventListener('keydown', handleEscapeCapture, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleEscapeCapture, { capture: true });
    };
  }, [isAutocompleteOpen]);

  /**
   * Filter users based on search query (case-insensitive substring match)
   */
  const filteredUsers = useMemo(() => {
    if (autocompleteType !== 'mention') return [];
    if (searchQuery === '') return projectMembers;

    const query = searchQuery.toLowerCase();
    return projectMembers.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [projectMembers, searchQuery, autocompleteType]);

  /**
   * Get the current list length based on autocomplete type
   */
  const currentListLength = useMemo(() => {
    switch (autocompleteType) {
      case 'mention':
        return filteredUsers.length;
      case 'ticket':
        return filteredTickets.length;
      case 'command':
        return filteredCommands.length;
      default:
        return 0;
    }
  }, [autocompleteType, filteredUsers.length, filteredTickets.length, filteredCommands.length]);

  /**
   * Get caret coordinates in textarea
   * Based on component-textarea-caret-position
   */
  const getCaretCoordinates = useCallback((element: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = getComputedStyle(element);
    const computed = [
      'boxSizing',
      'width',
      'height',
      'overflowX',
      'overflowY',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontStretch',
      'fontSize',
      'fontSizeAdjust',
      'lineHeight',
      'fontFamily',
      'textAlign',
      'textTransform',
      'textIndent',
      'textDecoration',
      'letterSpacing',
      'wordSpacing',
      'tabSize',
      'whiteSpace',
      'wordBreak',
      'wordWrap',
    ];

    computed.forEach(prop => {
      div.style.setProperty(prop, style.getPropertyValue(prop));
    });

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.overflow = 'auto';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.top = '0';
    div.style.left = '0';

    const textContent = element.value.substring(0, position);
    div.textContent = textContent;

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    document.body.appendChild(div);

    const coordinates = {
      top: span.offsetTop + parseInt(style.borderTopWidth),
      left: span.offsetLeft + parseInt(style.borderLeftWidth),
    };

    document.body.removeChild(div);

    return coordinates;
  }, []);

  /**
   * Calculate fixed (viewport) position to keep dropdown within viewport
   * Uses position: fixed to avoid clipping by parent overflow constraints
   * Shifts dropdown left when near right edge, flips above when near bottom
   */
  const calculateFixedPosition = useCallback((
    coords: { top: number; left: number },
    textareaRect: DOMRect
  ): { top: number; left: number } => {
    const dropdownWidth = 320; // w-80
    const dropdownHeight = 200; // max-h-[200px]
    const lineHeight = 24;
    const buffer = 16;

    // Calculate absolute viewport position for the dropdown
    let top = textareaRect.top + coords.top + lineHeight;
    let left = textareaRect.left + coords.left;

    // Check right edge overflow - shift left
    if (left + dropdownWidth > window.innerWidth - buffer) {
      left = Math.max(buffer, window.innerWidth - dropdownWidth - buffer);
    }

    // Check left edge overflow
    if (left < buffer) {
      left = buffer;
    }

    // Check bottom edge overflow - flip above if needed
    if (top + dropdownHeight > window.innerHeight - buffer) {
      const topAbove = textareaRect.top + coords.top - dropdownHeight - 8;
      if (topAbove > buffer) {
        top = topAbove;
      }
    }

    return { top, left };
  }, []);

  /**
   * Check if position is inside an existing mention markup
   */
  const isInsideMentionMarkup = useCallback((text: string, position: number): boolean => {
    // Look for @[ pattern before position and ] after
    const textBeforePos = text.substring(0, position);
    const lastMentionStart = textBeforePos.lastIndexOf('@[');
    if (lastMentionStart === -1) return false;

    // Check if there's a closing ] after the @[
    const textAfterMentionStart = text.substring(lastMentionStart);
    const closingBracket = textAfterMentionStart.indexOf(']');
    if (closingBracket === -1) return true; // Unclosed mention, we're inside

    // Check if position is before the closing bracket
    return position < lastMentionStart + closingBracket + 1;
  }, []);

  /**
   * Handle trigger detection and autocomplete triggering
   */
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);

    const textBeforeCursor = newValue.substring(0, cursorPos);

    // Check for / trigger (command autocomplete) - only after @ai-board mention
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      // Check if slash is after an AI-BOARD mention pattern @[id:AI-BOARD] or the display name
      const textBeforeSlash = textBeforeCursor.substring(0, lastSlashIndex);
      // Match @[...AI-BOARD] pattern followed by optional whitespace
      const aiBoardMentionPattern = /@\[[^\]]*AI-BOARD[^\]]*\]\s*$/;
      if (aiBoardMentionPattern.test(textBeforeSlash)) {
        const query = textBeforeCursor.substring(lastSlashIndex + 1);
        // Close autocomplete if query contains space (consistent with mention and ticket autocomplete)
        if (!query.includes(' ')) {
          setTriggerPosition(lastSlashIndex);
          setSearchQuery(query);
          setAutocompleteType('command');
          setSelectedIndex(0);
          return;
        }
      }
    }

    // Check for # trigger (ticket autocomplete)
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    if (lastHashIndex !== -1) {
      const charBeforeHash = textBeforeCursor[lastHashIndex - 1];
      const isHashAtWordBoundary = !charBeforeHash || /\s/.test(charBeforeHash);

      // Don't trigger inside existing mention markup
      if (isHashAtWordBoundary && !isInsideMentionMarkup(newValue, lastHashIndex)) {
        const query = textBeforeCursor.substring(lastHashIndex + 1);
        // Only show autocomplete if query doesn't contain spaces (still typing the reference)
        if (!query.includes(' ')) {
          setTriggerPosition(lastHashIndex);
          setSearchQuery(query);
          setAutocompleteType('ticket');
          setSelectedIndex(0);
          return;
        }
      }
    }

    // Check for @ trigger (user mention autocomplete)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
      const isAtWordBoundary = !charBeforeAt || /\s/.test(charBeforeAt);

      if (isAtWordBoundary) {
        // Check if we're inside existing mention markup
        const textAfterAt = textBeforeCursor.substring(lastAtIndex);
        const isInsideMention = textAfterAt.includes('@[') && textAfterAt.includes(':');

        if (!isInsideMention) {
          const query = textBeforeCursor.substring(lastAtIndex + 1);
          // Only show autocomplete if query doesn't contain spaces
          if (!query.includes(' ')) {
            setTriggerPosition(lastAtIndex);
            setSearchQuery(query);
            setAutocompleteType('mention');
            setSelectedIndex(0);
            return;
          }
        }
      }
    }

    // No trigger found, close autocomplete
    setAutocompleteType('none');
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isAutocompleteOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, currentListLength - 1)
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        e.preventDefault();
        handleEnterSelection();
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        setAutocompleteType('none');
        break;
    }
  };

  /**
   * Handle Enter key selection based on autocomplete type
   */
  const handleEnterSelection = () => {
    switch (autocompleteType) {
      case 'mention':
        if (filteredUsers[selectedIndex]) {
          handleSelectUser(filteredUsers[selectedIndex]);
        }
        break;
      case 'ticket':
        if (filteredTickets[selectedIndex]) {
          handleSelectTicket(filteredTickets[selectedIndex]);
        }
        break;
      case 'command':
        if (filteredCommands[selectedIndex]) {
          handleSelectCommand(filteredCommands[selectedIndex]);
        }
        break;
    }
  };

  /**
   * Handle user selection (mouse or keyboard)
   */
  const handleSelectUser = (user: ProjectMember) => {
    if (!textareaRef.current || triggerPosition === null) return;

    const currentCursorPos = textareaRef.current.selectionStart;
    const mention = formatMention(user.id, user.name || user.email);

    // Replace from @ to cursor with mention
    const newValue =
      value.substring(0, triggerPosition) +
      mention +
      ' ' + // Add space after mention
      value.substring(currentCursorPos);

    onChange(newValue);

    // Close autocomplete
    setAutocompleteType('none');
    setSearchQuery('');
    setTriggerPosition(null);

    // Position cursor after mention + space
    const newCursorPos = triggerPosition + mention.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  /**
   * Handle ticket selection (mouse or keyboard)
   */
  const handleSelectTicket = (ticket: SearchResult) => {
    if (!textareaRef.current || triggerPosition === null) return;

    const currentCursorPos = textareaRef.current.selectionStart;
    const ticketRef = `#${ticket.ticketKey}`;

    // Replace from # to cursor with ticket reference
    const newValue =
      value.substring(0, triggerPosition) +
      ticketRef +
      ' ' + // Add space after ticket reference
      value.substring(currentCursorPos);

    onChange(newValue);

    // Close autocomplete
    setAutocompleteType('none');
    setSearchQuery('');
    setTriggerPosition(null);

    // Position cursor after ticket reference + space
    const newCursorPos = triggerPosition + ticketRef.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  /**
   * Handle command selection (mouse or keyboard)
   */
  const handleSelectCommand = (command: AIBoardCommand) => {
    if (!textareaRef.current || triggerPosition === null) return;

    const currentCursorPos = textareaRef.current.selectionStart;

    // Replace from / to cursor with command name
    const newValue =
      value.substring(0, triggerPosition) +
      command.name +
      ' ' + // Add space after command
      value.substring(currentCursorPos);

    onChange(newValue);

    // Close autocomplete
    setAutocompleteType('none');
    setSearchQuery('');
    setTriggerPosition(null);

    // Position cursor after command + space
    const newCursorPos = triggerPosition + command.name.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  /**
   * Update autocomplete position when it opens and on scroll
   * Uses fixed positioning for viewport-based coordinates
   */
  useEffect(() => {
    if (!isAutocompleteOpen || !textareaRef.current || triggerPosition === null) {
      return;
    }

    const updatePosition = () => {
      if (!textareaRef.current || triggerPosition === null) return;
      const coords = getCaretCoordinates(textareaRef.current, triggerPosition);
      const rect = textareaRef.current.getBoundingClientRect();
      const fixedPosition = calculateFixedPosition(coords, rect);
      setAutocompletePosition(fixedPosition);
    };

    // Initial position
    updatePosition();

    // Update position on scroll (capture phase to catch all scroll events)
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isAutocompleteOpen, triggerPosition, getCaretCoordinates, calculateFixedPosition]);

  /**
   * Auto-scroll selected item into view
   */
  useEffect(() => {
    if (isAutocompleteOpen && selectedIndex >= 0) {
      // Use appropriate testid based on autocomplete type
      const testIdMap = {
        mention: 'mention-user-item',
        ticket: 'ticket-autocomplete-item',
        command: 'command-autocomplete-item',
      };
      const testId = testIdMap[autocompleteType as keyof typeof testIdMap];
      if (testId) {
        const selectedElement = document.querySelector(
          `[data-testid="${testId}"][data-selected="true"]`
        );
        selectedElement?.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isAutocompleteOpen, autocompleteType]);

  /**
   * Close autocomplete when clicking outside
   */
  useEffect(() => {
    if (!isAutocompleteOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check all autocomplete dropdowns
      const autocomplete =
        document.querySelector('[data-testid="mention-autocomplete"]') ||
        document.querySelector('[data-testid="ticket-autocomplete"]') ||
        document.querySelector('[data-testid="command-autocomplete"]');
      const textarea = textareaRef.current;

      if (
        autocomplete &&
        !autocomplete.contains(target) &&
        textarea &&
        !textarea.contains(target)
      ) {
        setAutocompleteType('none');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAutocompleteOpen]);

  /**
   * Render the appropriate autocomplete dropdown
   */
  const renderAutocomplete = () => {
    switch (autocompleteType) {
      case 'mention':
        return (
          <UserAutocomplete
            users={filteredUsers}
            onSelect={handleSelectUser}
            selectedIndex={selectedIndex}
            {...(aiBoardUser && {
              aiBoardUserId: aiBoardUser.id,
              aiBoardAvailable: availability?.available ?? false,
              aiBoardUnavailableReason: availability?.reason ?? 'Checking availability...',
            })}
          />
        );
      case 'ticket':
        return (
          <TicketAutocomplete
            tickets={filteredTickets}
            onSelect={handleSelectTicket}
            selectedIndex={selectedIndex}
          />
        );
      case 'command':
        return (
          <CommandAutocomplete
            commands={filteredCommands}
            onSelect={handleSelectCommand}
            selectedIndex={selectedIndex}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        rows={3}
      />

      {isAutocompleteOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed w-80"
          style={{
            zIndex: 9999,
            top: `${autocompletePosition.top}px`,
            left: `${autocompletePosition.left}px`,
          }}
        >
          {renderAutocomplete()}
        </div>,
        document.body
      )}
    </div>
  );
}
