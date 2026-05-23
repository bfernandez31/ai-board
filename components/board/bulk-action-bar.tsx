'use client';

import { Button } from '@/components/ui/button';

interface BulkActionBarProps {
  isVisible: boolean;
  selectedCount: number;
  onCancel: () => void;
  canMerge?: boolean;
  onDelete?: () => void;
  onChangeAgent?: () => void;
  onChangeModel?: () => void;
  onMerge?: () => void;
  isBusy?: boolean;
}

export function BulkActionBar({
  isVisible,
  selectedCount,
  onCancel,
  canMerge = false,
  onDelete,
  onChangeAgent,
  onChangeModel,
  onMerge,
  isBusy = false,
}: BulkActionBarProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div
        className="pointer-events-auto aurora-glass flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3 shadow-2xl"
        aria-busy={isBusy}
      >
        <div className="min-w-0" role="status" aria-live="polite">
          <p className="text-sm font-semibold text-foreground">{selectedCount} selected</p>
          <p className="text-xs text-muted-foreground">Bulk actions are available for INBOX tickets only.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!canMerge || isBusy} onClick={onMerge} aria-label="Merge selected tickets">
            Merge
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={onChangeAgent} aria-label="Change agent for selected tickets">
            Change agent
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={onChangeModel} aria-label="Change model for selected tickets">
            Change model
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={isBusy} onClick={onDelete} aria-label="Delete selected tickets">
            Delete
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isBusy} aria-label="Cancel bulk selection">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
