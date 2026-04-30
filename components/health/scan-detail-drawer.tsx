'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { DrawerHeader } from './drawer/drawer-header';
import { DrawerIssues } from './drawer/drawer-issues';
import { DrawerTickets } from './drawer/drawer-tickets';
import { DrawerHistory } from './drawer/drawer-history';
import { DrawerStates } from './drawer/drawer-states';
import { ScoreTrendChart } from './drawer/score-trend-chart';
import { Button } from '@/components/ui/button';
import { useScanReport } from '@/app/lib/hooks/useScanReport';
import { useScanById } from '@/app/lib/hooks/useScanById';
import { MODULE_METADATA } from '@/lib/health/types';
import type { HealthModuleType, HealthModuleStatus, TrendDataPoint } from '@/lib/health/types';

interface ScanDetailDrawerProps {
  projectId: number;
  moduleType: HealthModuleType | null;
  moduleStatus: HealthModuleStatus | null;
  isScanning: boolean;
  onClose: () => void;
  onTriggerScan?: (() => void) | undefined;
  trendData?: TrendDataPoint[] | undefined;
}

export function ScanDetailDrawer({
  projectId,
  moduleType,
  moduleStatus,
  isScanning,
  onClose,
  onTriggerScan,
  trendData,
}: ScanDetailDrawerProps) {
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  // FR-004: reset selection whenever the active module changes (the React-recommended
  // "adjust state during render when a prop changes" pattern — avoids the cascading
  // render an effect-based reset would trigger).
  const [prevModuleType, setPrevModuleType] = useState<HealthModuleType | null>(moduleType);
  if (prevModuleType !== moduleType) {
    setPrevModuleType(moduleType);
    setSelectedScanId(null);
  }

  // Treat selectedScanId as null during the same render the module changes —
  // otherwise useScanById fires a request keyed by the new moduleType + the
  // stale scanId, producing a transient empty state before the reset commits.
  const effectiveSelectedScanId = prevModuleType === moduleType ? selectedScanId : null;

  const {
    data: latestData,
    isLoading: isLatestLoading,
    isError: isLatestError,
  } = useScanReport(projectId, moduleType);
  const {
    data: selectedData,
    isLoading: isSelectedLoading,
    isError: isSelectedError,
  } = useScanById(projectId, moduleType, effectiveSelectedScanId);

  const isOpen = moduleType !== null;
  const moduleMeta = moduleType ? MODULE_METADATA[moduleType] : null;

  const isLoading =
    effectiveSelectedScanId === null ? isLatestLoading : isSelectedLoading;
  const isError =
    effectiveSelectedScanId === null ? isLatestError : isSelectedError;

  const displayedScan =
    effectiveSelectedScanId === null ? latestData?.scan ?? null : selectedData?.scan ?? null;
  const displayedReport =
    effectiveSelectedScanId === null ? latestData?.report ?? null : selectedData?.report ?? null;
  const latestScanId = latestData?.scan?.id ?? null;

  const hasCompletedScan = !isLoading && displayedScan?.status === 'COMPLETED';
  const hasReport = hasCompletedScan && displayedReport !== null;
  const isSkipped = !isLoading && displayedScan?.status === 'SKIPPED';
  const isDisplayedScanFailed = !isLoading && displayedScan?.status === 'FAILED';

  const showStates =
    !isLoading &&
    !hasCompletedScan &&
    !isSkipped &&
    (isScanning ||
      isDisplayedScanFailed ||
      moduleStatus?.scanStatus === 'FAILED' ||
      isError ||
      !displayedScan);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">
            {moduleMeta?.label ?? 'Module'} Scan Details
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed scan report for the {moduleMeta?.label ?? 'selected'} module
          </SheetDescription>
        </SheetHeader>

        {moduleType && moduleStatus && (
          <div className="space-y-6 mt-2">
            <DrawerHeader
              moduleType={moduleType}
              moduleStatus={moduleStatus}
              scan={displayedScan}
              isLoading={isLoading}
            />

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading report...</p>
              </div>
            )}

            {showStates && (
              <DrawerStates
                moduleType={moduleType}
                moduleStatus={moduleStatus}
                isScanning={isScanning}
                errorMessage={displayedScan?.errorMessage}
                onTriggerScan={onTriggerScan}
                isDisplayedScanFailed={isDisplayedScanFailed}
              />
            )}

            {isSkipped && (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Skipped</p>
                <p className="text-xs text-muted-foreground">
                  {moduleStatus?.skipReason || 'No reason provided'}
                </p>
                <p className="text-2xl font-bold text-muted-foreground">N/A</p>
                {onTriggerScan && moduleMeta && !moduleMeta.passive && (
                  <Button size="sm" variant="outline" onClick={onTriggerScan}>
                    Re-run scan
                  </Button>
                )}
              </div>
            )}

            {trendData && trendData.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Score Trend</h3>
                <div className="h-48 w-full">
                  <ScoreTrendChart data={trendData} />
                </div>
              </div>
            )}

            {hasReport && displayedReport && (
              <>
                <DrawerIssues report={displayedReport} />
                <DrawerTickets report={displayedReport} projectId={projectId} />
              </>
            )}

            {hasCompletedScan && !hasReport && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  {selectedScanId === null
                    ? 'Report data unavailable — scan predates structured reporting'
                    : 'No detailed report available for this scan'}
                </p>
              </div>
            )}

            {!isLoading && (
              <DrawerHistory
                projectId={projectId}
                moduleType={moduleType}
                selectedScanId={selectedScanId}
                latestScanId={latestScanId}
                onSelect={setSelectedScanId}
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
