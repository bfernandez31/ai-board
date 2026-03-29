'use client';

import { Loader2, AlertTriangle, Search, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HealthModuleStatus, HealthModuleType } from '@/lib/health/types';
import { MODULE_METADATA } from '@/lib/health/types';

interface DrawerStatesProps {
  moduleType: HealthModuleType;
  moduleStatus: HealthModuleStatus;
  isScanning: boolean;
  errorMessage?: string | null | undefined;
  onTriggerScan?: (() => void) | undefined;
}

type DrawerState = 'never_scanned' | 'scanning' | 'failed' | 'passive_no_data';

function getDrawerState(
  moduleType: HealthModuleType,
  moduleStatus: HealthModuleStatus,
  isScanning: boolean,
): DrawerState {
  if (isScanning) return 'scanning';
  if (moduleStatus.scanStatus === 'FAILED') return 'failed';
  const meta = MODULE_METADATA[moduleType];
  if (meta.passive && moduleStatus.score === null && moduleStatus.label !== 'OK') {
    return 'passive_no_data';
  }
  return 'never_scanned';
}

export function DrawerStates({
  moduleType,
  moduleStatus,
  isScanning,
  errorMessage,
  onTriggerScan,
}: DrawerStatesProps) {
  const state = getDrawerState(moduleType, moduleStatus, isScanning);
  const meta = MODULE_METADATA[moduleType];

  switch (state) {
    case 'scanning':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Scanning in progress...</p>
          <p className="text-xs text-muted-foreground">
            The {meta.label} scan is running. Results will appear here when complete.
          </p>
        </div>
      );

    case 'failed':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <AlertTriangle className="h-8 w-8 text-ctp-red" />
          <p className="text-sm font-medium text-ctp-red">Scan Failed</p>
          {errorMessage && (
            <p className="text-xs text-muted-foreground text-center max-w-xs">{errorMessage}</p>
          )}
          {onTriggerScan && (
            <Button size="sm" variant="outline" onClick={onTriggerScan}>
              Retry scan
            </Button>
          )}
        </div>
      );

    case 'passive_no_data':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Info className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No data available yet</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {meta.label} is a passive module that collects data from other workflows.
            Data will appear here as tickets are processed.
          </p>
        </div>
      );

    case 'never_scanned':
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No scan data yet</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Run your first {meta.label} scan to see detailed results here.
          </p>
          {onTriggerScan && !meta.passive && (
            <Button size="sm" variant="outline" onClick={onTriggerScan}>
              Run first scan
            </Button>
          )}
        </div>
      );
  }
}
