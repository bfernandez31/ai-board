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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { TicketWithVersion } from '@/lib/types';

const DESCRIPTION_LIMIT = 10000;

function buildMergePreviewDescription(tickets: TicketWithVersion[]): string {
  if (tickets.length === 0) {
    return '';
  }

  const [baseTicket, ...sourceTickets] = tickets;
  if (!baseTicket) {
    return '';
  }
  const sections = [baseTicket.description?.trim() ?? ''].filter(Boolean);

  for (const sourceTicket of sourceTickets) {
    const heading = `---\nSource: ${sourceTicket.ticketKey} ${sourceTicket.title}`;
    const body = sourceTicket.description?.trim();
    sections.push(body ? `${heading}\n${body}` : heading);
  }

  return sections.join('\n\n').trim();
}

interface BulkMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTickets: TicketWithVersion[];
  onSave: (input: {
    ticketIds: number[];
    expectedBaseTicketId: number;
    title: string;
    description: string;
  }) => Promise<void>;
}

export function BulkMergeDialog({
  open,
  onOpenChange,
  selectedTickets,
  onSave,
}: BulkMergeDialogProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const baseTicket = selectedTickets[0] ?? null;
  const remainingCharacters = DESCRIPTION_LIMIT - description.length;
  const isDescriptionInvalid = remainingCharacters < 0 || description.trim().length === 0;
  const isTitleInvalid = title.trim().length === 0 || title.trim().length > 100;

  React.useEffect(() => {
    if (open) {
      setTitle(baseTicket?.title ?? '');
      setDescription(buildMergePreviewDescription(selectedTickets));
      setError(null);
    }
  }, [baseTicket, open, selectedTickets]);

  const handleSave = async () => {
    if (!baseTicket || isTitleInvalid || isDescriptionInvalid) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        ticketIds: selectedTickets.map((ticket) => ticket.id),
        expectedBaseTicketId: baseTicket.id,
        title: title.trim(),
        description: description.trim(),
      });
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to merge tickets');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Merge {selectedTickets.length} tickets</DialogTitle>
          <DialogDescription>
            The oldest selected ticket survives. Review and edit the merged result before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Base ticket</p>
            <p data-testid="bulk-merge-base-ticket">{baseTicket?.ticketKey} {baseTicket?.title}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-merge-title">Final title</Label>
            <Input
              id="bulk-merge-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-merge-description">Merged description</Label>
            <Textarea
              id="bulk-merge-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[260px]"
            />
            <p
              className={`text-xs ${remainingCharacters < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
              data-testid="bulk-merge-remaining-characters"
            >
              {remainingCharacters >= 0
                ? `${remainingCharacters} characters remaining`
                : `${Math.abs(remainingCharacters)} characters over limit`}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Merge order</p>
            <div className="space-y-2" data-testid="bulk-merge-preview-order">
              {selectedTickets.map((ticket, index) => (
                <div key={ticket.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                  <span className="font-medium">{index === 0 ? 'Base' : 'Source'}:</span>{' '}
                  {ticket.ticketKey} {ticket.title}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !baseTicket || isTitleInvalid || isDescriptionInvalid}
            className="flex items-center gap-2"
            aria-label="Merge selected tickets"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Merging...' : 'Merge tickets'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
