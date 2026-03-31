'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
  const { data, isLoading } = useScanReport(projectId, moduleType);
  const isOpen = moduleType !== null;

  const moduleMeta = moduleType ? MODULE_METADATA[moduleType] : null;

  // Determine if we have a completed scan with report data
  const hasCompletedScan = !isLoading && data?.scan?.status === 'COMPLETED';
  const hasReport = hasCompletedScan && data?.report !== null;

  // Determine if we should show non-standard states
  const showStates = !isLoading && !hasCompletedScan && (
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

            {hasReport && data?.report && (
              <>
                <DrawerIssues report={data.report} />
                <DrawerTickets report={data.report} projectId={projectId} />
              </>
            )}

            {hasCompletedScan && !hasReport && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  Report data unavailable — scan predates structured reporting
                </p>
              </div>
            )}

            {trendData && trendData.length >= 1 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Score Trend</h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        className="text-[10px]"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        className="text-[10px]"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip
                        labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                        formatter={(value) => [`${value}`, 'Score']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.1)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!isLoading && (
              <DrawerHistory projectId={projectId} moduleType={moduleType} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
