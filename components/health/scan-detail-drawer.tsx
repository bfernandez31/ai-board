'use client';

import { Loader2, AlertTriangle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { getScoreColor } from '@/lib/quality-score';
import { ScanReportContent } from './scan-report-content';
import { GeneratedTicketsSection } from './generated-tickets-section';
import { ScanHistorySection } from './scan-history-section';
import { QualityGateContent } from './quality-gate-content';
import { LastCleanContent } from './last-clean-content';
import { MODULE_ICONS, getModuleLabel, getModuleState, ACTIVE_SCAN_SET } from './shared';
import { useScanReport } from '@/app/lib/hooks/useScanReport';
import type { HealthModuleType, HealthModuleStatus } from '@/lib/health/types';

interface ScanDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  moduleType: HealthModuleType;
  module: HealthModuleStatus;
  isScanning: boolean;
}

export function ScanDetailDrawer({
  open,
  onOpenChange,
  projectId,
  moduleType,
  module,
  isScanning,
}: ScanDetailDrawerProps) {
  const isActiveScanType = ACTIVE_SCAN_SET.has(moduleType);
  const state = getModuleState(module, isScanning);

  const { data: scanData } = useScanReport(
    projectId,
    moduleType,
    open && isActiveScanType
  );

  const Icon = MODULE_ICONS[moduleType];
  const label = getModuleLabel(moduleType);
  const scoreColors = module.score !== null ? getScoreColor(module.score) : null;

  const scan = scanData?.scan ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                {label}
                {scoreColors && module.score !== null && (
                  <span className={`text-sm font-medium ${scoreColors.text} ${scoreColors.bg} rounded-md px-2 py-0.5`}>
                    {module.score}
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>
                {scan?.completedAt && (
                  <span>
                    Last scan: {new Date(scan.completedAt).toLocaleDateString()}
                  </span>
                )}
                {scan?.baseCommit && scan?.headCommit && (
                  <span className="ml-2 text-xs font-mono">
                    {scan.baseCommit.slice(0, 7)}..{scan.headCommit.slice(0, 7)}
                  </span>
                )}
                {!scan?.completedAt && module.lastScanDate && (
                  <span>
                    Last scan: {new Date(module.lastScanDate).toLocaleDateString()}
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {state === 'never_scanned' && (
            <NeverScannedContent />
          )}

          {state === 'scanning' && (
            <ScanningContent />
          )}

          {state === 'completed' && isActiveScanType && (
            <>
              <ScanReportContent report={scan?.report ?? null} />
              <GeneratedTicketsSection
                projectId={projectId}
                scanId={scan?.id ?? null}
              />
              <ScanHistorySection
                projectId={projectId}
                moduleType={moduleType}
                enabled={open}
              />
            </>
          )}

          {state === 'failed' && (
            <FailedContent errorMessage={scan?.errorMessage ?? null} />
          )}

          {!isActiveScanType && moduleType === 'QUALITY_GATE' && (
            <QualityGateContent module={module} />
          )}

          {!isActiveScanType && moduleType === 'LAST_CLEAN' && (
            <LastCleanContent module={module} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NeverScannedContent() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">
        No scans have been run for this module yet.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Use the scan button on the card to trigger the first scan.
      </p>
    </div>
  );
}

function ScanningContent() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">Scan in progress...</p>
      <p className="text-xs text-muted-foreground mt-1">
        Results will appear here when the scan completes.
      </p>
    </div>
  );
}

function FailedContent({ errorMessage }: { errorMessage: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-ctp-red mb-3" />
      <p className="text-sm text-ctp-red font-medium">Scan failed</p>
      {errorMessage && (
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
