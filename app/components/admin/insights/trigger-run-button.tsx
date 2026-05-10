'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAdminInsightsTriggerMutation } from '@/app/hooks/admin/use-admin-insights-trigger';

export interface TriggerRunButtonProps {
  runningReportId: number | null;
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
      {runningReportId !== null
        ? 'Running…'
        : mutation.isPending
        ? 'Starting…'
        : 'Run new analysis'}
    </Button>
  );
}
