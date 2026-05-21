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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CharacterCounter } from '@/components/ui/character-counter';
import { AlertTriangle, GitMerge, Loader2 } from 'lucide-react';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';
import { useToast } from '@/hooks/use-toast';
import { useFuseTickets, FusionConflict } from '@/lib/hooks/mutations/useFuseTickets';

const DESCRIPTION_LIMIT = 10_000;
const TITLE_LIMIT = 100;

export interface FusionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  anchorId: number;
  anchorVersion: number;
  anchorKey: string;
  initialTitle: string;
  initialDescription: string;
  attachments: TicketAttachment[];
  clippedAttachmentCount: number;
  absorbed: Array<TicketRef & { ticketKey: string }>;
  onSuccess?: (anchorKey: string) => void;
}

export function FusionDialog({
  open,
  onOpenChange,
  projectId,
  anchorId,
  anchorVersion,
  anchorKey,
  initialTitle,
  initialDescription,
  attachments,
  clippedAttachmentCount,
  absorbed,
  onSuccess,
}: FusionDialogProps) {
  const { toast } = useToast();
  const mutation = useFuseTickets(projectId);

  const [title, setTitle] = React.useState(initialTitle);
  const [description, setDescription] = React.useState(initialDescription);

  React.useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription);
    }
  }, [open, initialTitle, initialDescription]);

  const descriptionLen = description.length;
  const tooLong = descriptionLen > DESCRIPTION_LIMIT;
  const tooShort = description.trim().length === 0;
  const titleEmpty = title.trim().length === 0;
  const titleTooLong = title.length > TITLE_LIMIT;
  const saveDisabled = mutation.isPending || tooLong || tooShort || titleEmpty || titleTooLong;

  const handleSave = async () => {
    try {
      const result = await mutation.mutateAsync({
        anchorId,
        anchorVersion,
        title: title.trim(),
        description,
        attachments,
        absorbed: absorbed.map(({ id, version }) => ({ id, version })),
      });
      toast({
        title: `Fused ${1 + absorbed.length} tickets into ${result.anchor.ticketKey}`,
      });
      onSuccess?.(result.anchor.ticketKey);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof FusionConflict) {
        toast({
          variant: 'destructive',
          title: 'Fusion blocked by conflict',
          description: `Tickets modified by another user: ${error.conflicting.join(', ')}`,
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Fusion failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <GitMerge className="h-5 w-5" /> Fuse {1 + absorbed.length} tickets into {anchorKey}
          </DialogTitle>
          <DialogDescription>
            The anchor will be updated with the combined title, description, and attachments below.
            The {absorbed.length} other ticket{absorbed.length === 1 ? '' : 's'} will be deleted
            atomically on save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="fusion-title">Title</Label>
            <Input
              id="fusion-title"
              value={title}
              maxLength={TITLE_LIMIT + 50}
              onChange={(e) => setTitle(e.target.value)}
              disabled={mutation.isPending}
            />
            {titleTooLong && (
              <p className="text-xs text-destructive">
                Title is {title.length} chars (limit {TITLE_LIMIT}).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fusion-description">Description</Label>
              <CharacterCounter current={descriptionLen} max={DESCRIPTION_LIMIT} />
            </div>
            <Textarea
              id="fusion-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={12}
              className="font-mono text-xs"
              data-testid="fusion-description-textarea"
            />
            {tooLong && (
              <p className="text-sm text-destructive" data-testid="fusion-too-long-banner">
                Description exceeds 10,000 character limit by {descriptionLen - DESCRIPTION_LIMIT}{' '}
                characters — please edit before saving.
              </p>
            )}
            {tooShort && (
              <p className="text-xs text-destructive">Description cannot be empty.</p>
            )}
          </div>

          {clippedAttachmentCount > 0 && (
            <div
              className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm"
              data-testid="fusion-clipped-banner"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
              <span>
                {clippedAttachmentCount === 1
                  ? '1 image dropped'
                  : `${clippedAttachmentCount} images dropped`}{' '}
                to keep the merged attachment list within the 5-image limit.
              </span>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="space-y-2">
              <Label>Attachments ({attachments.length}/5)</Label>
              <div className="grid grid-cols-5 gap-2">
                {attachments.map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.url}
                    src={a.url}
                    alt={a.filename}
                    className="rounded-md border border-border object-cover aspect-square w-full"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Absorbed tickets</Label>
            <p className="text-xs font-mono text-muted-foreground">
              {absorbed.map((a) => a.ticketKey).join(', ')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveDisabled}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mutation.isPending ? 'Fusing...' : `Fuse ${1 + absorbed.length} tickets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
