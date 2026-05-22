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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { isTicketAttachmentArray, type TicketAttachment } from '@/app/lib/types/ticket';
import type { TicketWithVersion } from '@/lib/types';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 10000;

export interface BulkMergePreviewModalProps {
  open: boolean;
  tickets: TicketWithVersion[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { baseTicketId: number; sourceTicketIds: number[]; title: string; description: string }) => void;
}

function readAttachments(value: unknown): TicketAttachment[] {
  return isTicketAttachmentArray(value) ? value : [];
}

function formatPrefilledDescription(base: TicketWithVersion, sourcesAsc: TicketWithVersion[]): string {
  const baseDesc = base.description ?? '';
  const blocks = sourcesAsc
    .map((s) => `---\n\n## From ${s.ticketKey}: ${s.title}\n${s.description ?? ''}`)
    .join('\n\n');
  return blocks ? `${baseDesc}\n\n${blocks}` : baseDesc;
}

export function BulkMergePreviewModal({
  open,
  tickets,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: BulkMergePreviewModalProps) {
  const ordered = React.useMemo(() => [...tickets].sort((a, b) => a.id - b.id), [tickets]);
  const base = ordered[0];
  const sources = ordered.slice(1);

  const initialTitle = base?.title ?? '';
  const initialDescription = React.useMemo(
    () => (base ? formatPrefilledDescription(base, sources) : ''),
    [base, sources]
  );

  const [title, setTitle] = React.useState(initialTitle);
  const [description, setDescription] = React.useState(initialDescription);

  React.useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription);
    }
  }, [open, initialTitle, initialDescription]);

  const hasValidSelection = base != null && sources.length > 0;

  React.useEffect(() => {
    if (open && !hasValidSelection) {
      onOpenChange(false);
    }
  }, [open, hasValidSelection, onOpenChange]);

  if (base == null || sources.length === 0) return null;

  const attachmentCount =
    readAttachments(base.attachments).length +
    sources.reduce((acc, s) => acc + readAttachments(s.attachments).length, 0);

  const titleInvalid = title.trim().length === 0 || title.trim().length > TITLE_MAX;
  const descriptionInvalid = description.trim().length === 0 || description.length > DESCRIPTION_MAX;
  const submitDisabled = isSubmitting || titleInvalid || descriptionInvalid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle data-testid="bulk-merge-title">
            Merge {ordered.length} tickets
          </DialogTitle>
          <DialogDescription>
            Base: {base.ticketKey} — {base.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div data-testid="bulk-merge-sources" className="space-y-1">
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm"
                data-testid={`bulk-merge-source-${s.id}`}
              >
                <span className="font-mono">{s.ticketKey}</span>
                <span className="text-muted-foreground flex-1 truncate px-2">{s.title}</span>
                <Badge variant="destructive">will be deleted</Badge>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label htmlFor="bulk-merge-title-input" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="bulk-merge-title-input"
              data-testid="bulk-merge-title-input"
              value={title}
              maxLength={TITLE_MAX + 50}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div
              data-testid="bulk-merge-title-counter"
              className={`text-xs ${title.length > TITLE_MAX ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {title.length} / {TITLE_MAX}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="bulk-merge-description-input" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="bulk-merge-description-input"
              data-testid="bulk-merge-description-input"
              value={description}
              rows={10}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div
              data-testid="bulk-merge-description-counter"
              className={`text-xs ${description.length > DESCRIPTION_MAX ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {description.length} / {DESCRIPTION_MAX}
            </div>
          </div>

          <div className="text-sm text-muted-foreground" data-testid="bulk-merge-attachment-count">
            Combined attachments: {attachmentCount}
          </div>

          {errorMessage ? (
            <div
              data-testid="bulk-merge-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            data-testid="bulk-merge-confirm"
            disabled={submitDisabled}
            onClick={() => {
              onSubmit({
                baseTicketId: base.id,
                sourceTicketIds: sources.map((s) => s.id),
                title: title.trim(),
                description,
              });
            }}
          >
            {isSubmitting ? 'Merging...' : `Merge ${ordered.length} tickets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
