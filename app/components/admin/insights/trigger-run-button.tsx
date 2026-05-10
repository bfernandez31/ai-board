'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAdminInsightsTriggerMutation } from '@/app/hooks/admin/use-admin-insights-trigger';

export interface TriggerRunButtonProps {
  runningReportId: number | null;
}

function buttonLabel(
  runningReportId: number | null,
  isPending: boolean
): string {
  if (runningReportId !== null) return 'Running…';
  if (isPending) return 'Starting…';
  return 'Run new analysis';
}

export function TriggerRunButton({
  runningReportId,
}: TriggerRunButtonProps): JSX.Element {
  const { toast } = useToast();
  const mutation = useAdminInsightsTriggerMutation();

  useEffect(() => {
    if (mutation.error) {
      toast({
        title: 'Cannot start analysis',
        description: mutation.error.error,
        variant: 'destructive',
      });
    }
  }, [mutation.error, toast]);

  const disabled = mutation.isPending || runningReportId !== null;

  return (
    <Button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={disabled}
      data-testid="insights-trigger-run-button"
    >
      {buttonLabel(runningReportId, mutation.isPending)}
    </Button>
  );
}
