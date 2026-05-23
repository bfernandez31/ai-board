'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CLAUDE_MODEL_IDS, CLAUDE_MODEL_LABELS } from '@/lib/models/claude-models';

interface BulkChangeModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSave: (modelId: string) => Promise<void>;
}

export function BulkChangeModelDialog({
  open,
  onOpenChange,
  selectedCount,
  onSave,
}: BulkChangeModelDialogProps) {
  const [selectedModelId, setSelectedModelId] = React.useState<string>(CLAUDE_MODEL_IDS[0]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelectedModelId(CLAUDE_MODEL_IDS[0]);
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(selectedModelId);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update models');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change model for {selectedCount} tickets</DialogTitle>
          <DialogDescription>
            Apply one Claude model across all ticket-level stage model fields for this selection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-model-select">Model</Label>
            <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={isSaving}>
              <SelectTrigger id="bulk-model-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAUDE_MODEL_IDS.map((modelId) => (
                  <SelectItem key={modelId} value={modelId}>
                    {CLAUDE_MODEL_LABELS[modelId]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving} className="flex items-center gap-2" aria-label="Apply model change">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
