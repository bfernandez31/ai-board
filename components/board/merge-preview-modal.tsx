'use client';

import { useState, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import type { TicketWithVersion } from '@/lib/types';

const MAX_DESCRIPTION = 10000;
const MAX_TITLE = 100;

export interface MergePreviewModalProps {
  tickets: TicketWithVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mergedTitle: string, mergedDescription: string, selectedAttachments: string[]) => void;
  isMerging?: boolean;
}

function buildMergedDescription(tickets: TicketWithVersion[]): string {
  if (tickets.length === 0) return '';
  const sorted = [...tickets].sort((a, b) => a.id - b.id);
  const base = sorted[0]!;
  const parts: string[] = [];

  if (base.description) {
    parts.push(base.description);
  }

  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i]!;
    if (t.description) {
      parts.push(`---\n\n## From ${t.ticketKey}: ${t.title}\n\n${t.description}`);
    }
  }

  return parts.join('\n\n');
}

export function MergePreviewModal({
  tickets,
  open,
  onOpenChange,
  onConfirm,
  isMerging = false,
}: MergePreviewModalProps) {
  const sorted = useMemo(() => [...tickets].sort((a, b) => a.id - b.id), [tickets]);
  const baseTicket = sorted[0];

  const defaultDescription = useMemo(() => buildMergedDescription(tickets), [tickets]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const effectiveTitle = title || baseTicket?.title || '';
  const effectiveDescription = description || defaultDescription;
  const charCount = effectiveDescription.length;
  const isOverLimit = charCount > MAX_DESCRIPTION;
  const isTitleOverLimit = effectiveTitle.length > MAX_TITLE;

  if (tickets.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge {tickets.length} tickets</DialogTitle>
          <DialogDescription>
            The base ticket (lowest ID) will be updated. Source tickets will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tickets to merge</Label>
            <ul className="space-y-1 text-sm">
              {sorted.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{t.ticketKey}</span>
                  <span className="truncate">{t.title}</span>
                  {i === 0 && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      base
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merge-title">Title</Label>
            <Input
              id="merge-title"
              value={effectiveTitle}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              disabled={isMerging}
            />
            {isTitleOverLimit && (
              <p className="text-xs text-destructive">Title must be {MAX_TITLE} characters or fewer</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merge-description">Description</Label>
            <Textarea
              id="merge-description"
              aria-label="Description"
              value={effectiveDescription}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              disabled={isMerging}
              className="font-mono text-xs"
            />
            <p className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {charCount.toLocaleString()} / 10,000
              {isOverLimit && ` — remove ${(charCount - MAX_DESCRIPTION).toLocaleString()} characters`}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Job history, comments, and notifications from non-base tickets will be{' '}
              <strong className="text-foreground">permanently lost</strong>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(effectiveTitle, effectiveDescription, [])}
            disabled={isMerging || isOverLimit || isTitleOverLimit || effectiveTitle.trim() === ''}
          >
            {isMerging ? 'Merging...' : `Merge ${tickets.length} tickets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
