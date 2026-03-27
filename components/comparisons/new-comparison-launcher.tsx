'use client';

import { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useVerifyStageTickets, useLaunchComparison } from '@/hooks/use-project-comparisons';

interface NewComparisonLauncherProps {
  projectId: number;
}

export function NewComparisonLauncher({ projectId }: NewComparisonLauncherProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: ticketsData, isLoading: isLoadingTickets } = useVerifyStageTickets(
    projectId,
    open
  );
  const launchMutation = useLaunchComparison(projectId);

  const tickets = ticketsData?.tickets ?? [];

  const handleToggle = (ticketId: number) => {
    setSelectedIds((prev) =>
      prev.includes(ticketId) ? prev.filter((id) => id !== ticketId) : [...prev, ticketId]
    );
  };

  const handleLaunch = async () => {
    await launchMutation.mutateAsync({ ticketIds: selectedIds });
    setSelectedIds([]);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedIds([]);
      launchMutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <GitCompare className="h-4 w-4 mr-2" />
          New Comparison
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Comparison</DialogTitle>
          <DialogDescription>
            Select 2 or more VERIFY-stage tickets to compare their implementations.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoadingTickets ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No tickets are currently in the VERIFY stage. Move tickets to VERIFY to enable
                comparisons.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tickets.map((ticket) => (
                <label
                  key={ticket.id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={selectedIds.includes(ticket.id)}
                    onChange={() => handleToggle(ticket.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{ticket.ticketKey}</span>
                      <span className="text-sm text-muted-foreground truncate">{ticket.title}</span>
                    </div>
                    {ticket.branch && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {ticket.branch}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {launchMutation.error && (
            <p className="text-sm text-destructive mt-2">
              {launchMutation.error.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={selectedIds.length < 2 || launchMutation.isPending}
          >
            {launchMutation.isPending ? 'Launching...' : `Compare (${selectedIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
