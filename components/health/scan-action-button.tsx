'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, RotateCcw } from 'lucide-react';
import type { ModuleStatus } from '@/lib/health/types';

interface ScanActionButtonProps {
  projectId: number;
  scanType: string;
  status: ModuleStatus;
  onScanTriggered?: () => void;
}

export function ScanActionButton({ projectId, scanType, status, onScanTriggered }: ScanActionButtonProps) {
  const [isTriggering, setIsTriggering] = useState(false);

  const handleTriggerScan = async () => {
    setIsTriggering(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/health/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType }),
      });

      if (response.ok) {
        onScanTriggered?.();
      }
    } finally {
      setIsTriggering(false);
    }
  };

  if (status === 'scanning' || isTriggering) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Scanning...
      </Button>
    );
  }

  if (status === 'failed') {
    return (
      <Button size="sm" variant="outline" onClick={handleTriggerScan}>
        <RotateCcw className="mr-1 h-3 w-3" />
        Retry
      </Button>
    );
  }

  if (status === 'never_scanned') {
    return (
      <Button size="sm" variant="outline" onClick={handleTriggerScan}>
        <Play className="mr-1 h-3 w-3" />
        Run first scan
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleTriggerScan}>
      <Play className="mr-1 h-3 w-3" />
      Run Scan
    </Button>
  );
}
