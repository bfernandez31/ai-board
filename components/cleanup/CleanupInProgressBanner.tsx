'use client';

import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CleanupInProgressBannerProps {
  projectId: number;
  jobId: number;
}

/**
 * Displays a warning banner when cleanup workflow is in progress
 */
export function CleanupInProgressBanner({
  projectId,
  jobId,
}: CleanupInProgressBannerProps) {
  const { jobs } = useJobPolling(projectId, 2000);

  const cleanupJob = jobs.find((job) => job.id === jobId);

  if (!cleanupJob || !['PENDING', 'RUNNING'].includes(cleanupJob.status)) {
    return null;
  }

  return (
    <Alert variant="warning" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <strong>Project cleanup in progress</strong> — Stage transitions are
        temporarily disabled. You can still update ticket descriptions, documents,
        and preview deployments. The board will automatically unlock when cleanup
        completes.
      </AlertDescription>
    </Alert>
  );
}
