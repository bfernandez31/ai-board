'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  STAGE_MODEL_KEYS,
  STAGE_MODEL_LABELS,
  type StageModelKey,
} from '@/lib/models/claude-models';
import { Loader2 } from 'lucide-react';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';
import { useBulkSetModel } from '@/lib/hooks/mutations/useBulkSetModel';
import { useToast } from '@/hooks/use-toast';
import { formatBulkResultToast } from '@/lib/board/bulk-result-toast';

const INHERIT_VALUE = '__inherit__';

export interface BulkModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  tickets: TicketRef[];
  onSuccess?: (skippedIds: number[]) => void;
}

export function BulkModelDialog({
  open,
  onOpenChange,
  projectId,
  tickets,
  onSuccess,
}: BulkModelDialogProps) {
  const { toast } = useToast();
  const mutation = useBulkSetModel(projectId);

  const [stage, setStage] = React.useState<StageModelKey>('implementModel');
  const [model, setModel] = React.useState<string>(INHERIT_VALUE);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setStage('implementModel');
      setModel(INHERIT_VALUE);
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setError(null);
    try {
      const data = await mutation.mutateAsync({
        stage,
        model: model === INHERIT_VALUE ? null : model,
        tickets,
      });
      const summary = formatBulkResultToast({
        successCount: data.affected.length,
        skipped: data.skipped,
        verbPast: 'updated',
      });
      toast({
        title: summary.title,
        ...(summary.description ? { description: summary.description } : {}),
      });
      onSuccess?.(data.skipped.map((s) => s.ticketId));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk change model override</DialogTitle>
          <DialogDescription>
            Apply a per-stage model override to {tickets.length}{' '}
            {tickets.length === 1 ? 'ticket' : 'tickets'}. Choose &ldquo;Inherit project default&rdquo; to clear the override.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bulk-model-stage">Stage</Label>
            <Select
              value={stage}
              onValueChange={(v) => setStage(v as StageModelKey)}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="bulk-model-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_MODEL_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {STAGE_MODEL_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-model-id">Model</Label>
            <Select value={model} onValueChange={setModel} disabled={mutation.isPending}>
              <SelectTrigger id="bulk-model-id">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT_VALUE}>Inherit project default</SelectItem>
                {CLAUDE_MODEL_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {CLAUDE_MODEL_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mutation.isPending ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
