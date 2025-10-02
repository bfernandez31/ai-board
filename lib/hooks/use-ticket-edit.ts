import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';

interface UseTicketEditParams {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  maxLength: number;
}

interface UseTicketEditReturn {
  isEditing: boolean;
  value: string;
  isSaving: boolean;
  error: string | null;
  startEdit: () => void;
  cancelEdit: () => void;
  save: () => Promise<void>;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
}

export function useTicketEdit({
  initialValue,
  onSave,
  maxLength,
}: UseTicketEditParams): UseTicketEditReturn {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [value, setValue] = useState<string>(initialValue);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const originalValueRef = useRef<string>(initialValue);

  // Update internal value when initialValue changes
  useEffect(() => {
    if (!isEditing) {
      setValue(initialValue);
      originalValueRef.current = initialValue;
    }
  }, [initialValue, isEditing]);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEdit = (): void => {
    setIsEditing(true);
    setError(null);
  };

  const cancelEdit = (): void => {
    setValue(originalValueRef.current);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async (): Promise<void> => {
    const trimmedValue = value.trim();

    // Validate empty value
    if (trimmedValue.length === 0) {
      setError('Value cannot be empty');
      return;
    }

    // Validate max length
    if (trimmedValue.length > maxLength) {
      setError(`Value must be ${maxLength} characters or less`);
      return;
    }

    // Check if value actually changed
    if (trimmedValue === originalValueRef.current) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setIsEditing(false);

    try {
      await onSave(trimmedValue);
      originalValueRef.current = trimmedValue;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      // Rollback to original value on error
      setValue(originalValueRef.current);
      // Keep edit mode closed; rollback handled via toast/UI feedback
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    setValue(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const nativeEvent = e.nativeEvent as { stopImmediatePropagation?: () => void };
    const isTextarea = e.currentTarget.tagName === 'TEXTAREA';
    const hasMeta = e.ctrlKey || e.metaKey;

    if (e.key === 'Enter') {
      if (isTextarea && !hasMeta && !e.shiftKey) {
        // Plain Enter inside textarea -> allow newline
        return;
      }

      if (isTextarea && e.shiftKey && !hasMeta) {
        // Shift+Enter for textarea -> newline but keep event local
        e.stopPropagation();
        return;
      }

      if (!e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        nativeEvent.stopImmediatePropagation?.();
        handleSave();
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      nativeEvent.stopImmediatePropagation?.();
      cancelEdit();
    }
  };

  return {
    isEditing,
    value,
    isSaving,
    error,
    startEdit,
    cancelEdit,
    save: handleSave,
    handleChange,
    handleKeyDown,
    inputRef: inputRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  };
}
