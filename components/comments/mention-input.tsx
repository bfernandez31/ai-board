/**
 * MentionInput Component
 *
 * Textarea with @ detection and autocomplete for user mentions.
 * Handles:
 * - @ symbol detection at word boundaries
 * - Client-side user filtering
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Mouse selection
 * - Mention insertion at cursor position
 * - Multiple mentions support
 */

'use client';

import { useState, useRef, useMemo, useCallback, KeyboardEvent, ChangeEvent, useEffect } from 'react';
import { ProjectMember } from '@/app/lib/types/mention';
import { formatMention } from '@/app/lib/utils/mention-parser';
import { UserAutocomplete } from './user-autocomplete';
import { Textarea } from '@/components/ui/textarea';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  projectMembers: ProjectMember[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  projectMembers,
  placeholder = 'Add a comment...',
  className,
  disabled = false,
}: MentionInputProps) {
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [atSymbolPosition, setAtSymbolPosition] = useState<number | null>(null);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Filter users based on search query (case-insensitive substring match)
   */
  const filteredUsers = useMemo(() => {
    if (searchQuery === '') return projectMembers;

    const query = searchQuery.toLowerCase();
    return projectMembers.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [projectMembers, searchQuery]);

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
   * Handle @ detection and autocomplete triggering
   */
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);

    // Find @ symbol before cursor
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      setIsAutocompleteOpen(false);
      return;
    }

    // Check if @ is at word boundary (start of word or after whitespace)
    const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
    const isAtWordBoundary = !charBeforeAt || /\s/.test(charBeforeAt);

    if (!isAtWordBoundary) {
      setIsAutocompleteOpen(false);
      return;
    }

    // Check if cursor is inside existing mention markup (prevent nested mentions)
    const textAfterAt = textBeforeCursor.substring(lastAtIndex);
    const isInsideMention = textAfterAt.includes('@[') && textAfterAt.includes(':');

    if (isInsideMention) {
      setIsAutocompleteOpen(false);
      return;
    }

    // Extract search query after @
    const query = textBeforeCursor.substring(lastAtIndex + 1);

    // Open autocomplete and update search query
    setAtSymbolPosition(lastAtIndex);
    setSearchQuery(query);
    setIsAutocompleteOpen(true);
    setSelectedIndex(0); // Reset selection
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
          Math.min(prev + 1, filteredUsers.length - 1)
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          handleSelectUser(filteredUsers[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsAutocompleteOpen(false);
        break;
    }
  };

  /**
   * Handle user selection (mouse or keyboard)
   */
  const handleSelectUser = (user: ProjectMember) => {
    if (!textareaRef.current || atSymbolPosition === null) return;

    const currentCursorPos = textareaRef.current.selectionStart;
    const mention = formatMention(user.id, user.name || user.email);

    // Replace from @ to cursor with mention
    const newValue =
      value.substring(0, atSymbolPosition) +
      mention +
      ' ' + // Add space after mention
      value.substring(currentCursorPos);

    onChange(newValue);

    // Close autocomplete
    setIsAutocompleteOpen(false);
    setSearchQuery('');
    setAtSymbolPosition(null);

    // Position cursor after mention + space
    const newCursorPos = atSymbolPosition + mention.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };


  /**
   * Update autocomplete position when it opens
   */
  useEffect(() => {
    if (isAutocompleteOpen && textareaRef.current && atSymbolPosition !== null) {
      const coords = getCaretCoordinates(textareaRef.current, atSymbolPosition);

      // Position below the caret with line height offset
      setAutocompletePosition({
        top: coords.top + 24, // Add line height
        left: coords.left,
      });
    }
  }, [isAutocompleteOpen, atSymbolPosition, getCaretCoordinates]);

  /**
   * Auto-scroll selected item into view
   */
  useEffect(() => {
    if (isAutocompleteOpen && selectedIndex >= 0) {
      const selectedElement = document.querySelector(
        '[data-testid="mention-user-item"][data-selected="true"]'
      );
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isAutocompleteOpen]);

  /**
   * Close autocomplete when clicking outside
   */
  useEffect(() => {
    if (!isAutocompleteOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const autocomplete = document.querySelector('[data-testid="mention-autocomplete"]');
      const textarea = textareaRef.current;

      if (
        autocomplete &&
        !autocomplete.contains(target) &&
        textarea &&
        !textarea.contains(target)
      ) {
        setIsAutocompleteOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAutocompleteOpen]);

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

      {isAutocompleteOpen && (
        <div
          className="absolute w-80"
          style={{
            zIndex: 9999,
            top: `${autocompletePosition.top}px`,
            left: `${autocompletePosition.left}px`,
          }}
        >
          <UserAutocomplete
            users={filteredUsers}
            onSelect={handleSelectUser}
            selectedIndex={selectedIndex}
          />
        </div>
      )}
    </div>
  );
}
