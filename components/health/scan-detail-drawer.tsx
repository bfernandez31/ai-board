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
  const { data: latestData } = useScanReport(projectId, moduleType, null);
  const { data, isLoading } = useScanReport(projectId, moduleType, selectedScanId);
  const isOpen = moduleType !== null;
  const latestScanId = latestData?.scan?.id ?? null;

  const moduleMeta = moduleType ? MODULE_METADATA[moduleType] : null;

  // Determine if we have a completed scan with report data
  const hasCompletedScan = !isLoading && data?.scan?.status === 'COMPLETED';
  const hasReport = hasCompletedScan && data?.report !== null;
  const isSkipped = !isLoading && data?.scan?.status === 'SKIPPED';

  // Determine if we should show non-standard states
  const showStates = !isLoading && !hasCompletedScan && !isSkipped && (
    isScanning ||
    moduleStatus?.scanStatus === 'FAILED' ||
    !data?.scan
  );

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
              scan={data?.scan ?? null}
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
                errorMessage={data?.scan?.errorMessage}
                onTriggerScan={onTriggerScan}
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

            {hasReport && data?.report && (
              <>
                <DrawerIssues report={data.report} />
                <DrawerTickets report={data.report} projectId={projectId} />
              </>
            )}

            {hasCompletedScan && !hasReport && selectedScanId === null && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  Report data unavailable — scan predates structured reporting
                </p>
              </div>
            )}

            {selectedScanId !== null && !isLoading && data?.scan?.status === 'COMPLETED' && !data?.report && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  Report not available for this scan
                </p>
              </div>
            )}

            {!isLoading && (
              <DrawerHistory
                projectId={projectId}
                moduleType={moduleType}
                selectedScanId={selectedScanId}
                latestScanId={latestScanId}
                onSelectScan={setSelectedScanId}
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
