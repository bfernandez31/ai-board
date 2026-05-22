'use client';

import { Button } from '@/components/ui/button';
import { Trash2, GitMerge, X } from 'lucide-react';

interface FloatingActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onMerge: () => void;
  onCancel: () => void;
}

export function FloatingActionBar({
  selectedCount,
  onDelete,
  onMerge,
  onCancel,
}: FloatingActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      data-testid="floating-action-bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border px-5 py-2.5 aurora-glass shadow-[0_8px_32px_hsl(0_0%_0%/0.5)] animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedCount} selected
      </span>

      <div className="h-5 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onMerge}
        disabled={selectedCount < 2}
        className="gap-1.5 text-sm"
        data-testid="bulk-merge-button"
      >
        <GitMerge className="h-4 w-4" />
        Merge
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="gap-1.5 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
        data-testid="bulk-delete-button"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-7 w-7 rounded-full"
        data-testid="bulk-cancel-button"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
