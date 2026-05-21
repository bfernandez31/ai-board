'use client';

import * as React from 'react';
import { Agent } from '@prisma/client';
import { AgentEditDialog } from '@/components/tickets/agent-edit-dialog';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';
import { useBulkSetAgent } from '@/lib/hooks/mutations/useBulkSetAgent';
import { useToast } from '@/hooks/use-toast';
import { formatBulkResultToast } from '@/lib/board/bulk-result-toast';

export interface BulkAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectDefaultAgent: Agent;
  tickets: TicketRef[];
  onSuccess?: (skippedIds: number[]) => void;
}

export function BulkAgentDialog({
  open,
  onOpenChange,
  projectId,
  projectDefaultAgent,
  tickets,
  onSuccess,
}: BulkAgentDialogProps) {
  const { toast } = useToast();
  const mutation = useBulkSetAgent(projectId);

  const handleSave = React.useCallback(
    async (agent: Agent | null) => {
      const data = await mutation.mutateAsync({ agent, tickets });
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
    },
    [mutation, tickets, toast, onSuccess],
  );

  return (
    <AgentEditDialog
      open={open}
      onOpenChange={onOpenChange}
      currentAgent={null}
      projectDefaultAgent={projectDefaultAgent}
      onSave={handleSave}
    />
  );
}
