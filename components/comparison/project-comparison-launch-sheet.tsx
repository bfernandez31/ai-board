'use client';

import { Loader2, Play, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectComparisonLaunchSheetProps } from './types';

function getQualityLabel(
  qualityScore: ProjectComparisonLaunchSheetProps['candidates'][number]['qualityScore']
) {
  if (qualityScore.state === 'available') {
    return `${qualityScore.value}`;
  }

  if (qualityScore.state === 'pending') {
    return 'Pending';
  }

  return 'N/A';
}

export function ProjectComparisonLaunchSheet({
  open,
  onOpenChange,
  candidates,
  selectedTicketIds,
  pendingLaunches,
  isLoading = false,
  isLaunching = false,
  onSelectionChange,
  onLaunch,
}: ProjectComparisonLaunchSheetProps) {
  const hasEnoughTickets = selectedTicketIds.length >= 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Launch a new comparison</SheetTitle>
          <SheetDescription>
            Select 2 to 5 VERIFY tickets. The hub will reuse the existing compare workflow.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {pendingLaunches.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-4 w-4" />
                Pending launches
              </div>
              <div className="mt-2 space-y-2 text-muted-foreground">
                {pendingLaunches.map((launch) => (
                  <div key={launch.jobId}>
                    {launch.selectedTicketKeys.join(', ')}: {launch.status}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading VERIFY tickets...</div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No VERIFY tickets are ready for a comparison launch.
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate) => {
                const selected = selectedTicketIds.includes(candidate.id);

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    className={cn(
                      'w-full rounded-xl border px-4 py-4 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-muted/40'
                    )}
                    onClick={() =>
                      onSelectionChange(
                        selected
                          ? selectedTicketIds.filter((ticketId) => ticketId !== candidate.id)
                          : [...selectedTicketIds, candidate.id]
                      )
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{candidate.ticketKey}</div>
                        <div className="text-sm text-muted-foreground">{candidate.title}</div>
                      </div>
                      <Badge variant="outline">Quality {getQualityLabel(candidate.qualityScore)}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              {selectedTicketIds.length} ticket{selectedTicketIds.length === 1 ? '' : 's'} selected
            </div>
            <Button type="button" onClick={onLaunch} disabled={!hasEnoughTickets || isLaunching}>
              {isLaunching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Launch comparison
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
