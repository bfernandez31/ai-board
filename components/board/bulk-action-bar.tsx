'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Bot, Sliders, GitMerge, X } from 'lucide-react';

const SELECTION_CAP = 50;

export interface BulkActionBarProps {
  selectionCount: number;
  onChangeAgent: () => void;
  onChangeModel: () => void;
  onFusion: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectionCount,
  onChangeAgent,
  onChangeModel,
  onFusion,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  if (selectionCount === 0) return null;

  const selectionTooLarge = selectionCount > SELECTION_CAP;
  const fusionDisabled = selectionTooLarge || selectionCount < 2;
  const otherDisabled = selectionTooLarge;

  return (
    <div
      data-testid="bulk-action-bar"
      role="toolbar"
      aria-label="Bulk ticket actions"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 aurora-glass border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3"
    >
      <Badge variant="secondary" className="font-mono" data-testid="bulk-selection-count">
        {selectionCount} selected
      </Badge>

      {selectionTooLarge && (
        <span className="text-xs text-destructive" data-testid="bulk-selection-too-large">
          Limit is {SELECTION_CAP} tickets per action
        </span>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onChangeAgent}
          disabled={otherDisabled}
          data-testid="bulk-change-agent"
        >
          <Bot className="mr-1 h-4 w-4" /> Change agent
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onChangeModel}
          disabled={otherDisabled}
          data-testid="bulk-change-model"
        >
          <Sliders className="mr-1 h-4 w-4" /> Change model
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onFusion}
          disabled={fusionDisabled}
          data-testid="bulk-fusion"
          title={selectionCount < 2 ? 'Select at least 2 tickets to fuse' : undefined}
        >
          <GitMerge className="mr-1 h-4 w-4" /> Fusion
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          disabled={otherDisabled}
          data-testid="bulk-delete"
        >
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
        data-testid="bulk-clear-selection"
        className="ml-1"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
