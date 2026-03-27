'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, GitCompare, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ComparisonLaunchRequest } from '@/lib/types/comparison';
import {
  comparisonKeys,
  useProjectComparisonCandidates,
  useProjectComparisonDetail,
  useProjectComparisonLaunch,
  useProjectComparisonList,
  useProjectComparisonPendingJobs,
} from '@/hooks/use-comparisons';
import { ComparisonDashboard } from './comparison-viewer';
import { ProjectComparisonLaunchSheet } from './project-comparison-launch-sheet';
import type { ProjectComparisonsPageProps } from './types';

const PAGE_SIZE = 10;
const ACTIVE_LAUNCH_STATUSES = ['PENDING', 'RUNNING'] as const;
const TERMINAL_LAUNCH_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;

function hasLaunchStatus(
  launch: ComparisonLaunchRequest,
  statuses: readonly ComparisonLaunchRequest['status'][]
): boolean {
  return statuses.includes(launch.status);
}

function mergePendingLaunches(
  pendingLaunches: ComparisonLaunchRequest[],
  jobStatuses:
    | Array<{ id: number; status: ComparisonLaunchRequest['status'] }>
    | undefined
): ComparisonLaunchRequest[] {
  if (!jobStatuses || jobStatuses.length === 0) {
    return pendingLaunches;
  }

  const statusByJobId = new Map(jobStatuses.map((job) => [job.id, job.status] as const));

  return pendingLaunches.map((launch) => {
    const nextStatus = statusByJobId.get(launch.jobId);
    if (!nextStatus) {
      return launch;
    }

    return { ...launch, status: nextStatus };
  });
}

export function ProjectComparisonsPage({
  projectId,
  projectName,
  initialPage = 1,
  initialComparisonId = null,
}: ProjectComparisonsPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(initialPage);
  const [selectedComparisonIdOverride, setSelectedComparisonIdOverride] = useState<number | null>(
    initialComparisonId
  );
  const [launchOpen, setLaunchOpen] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [pendingLaunches, setPendingLaunches] = useState<ComparisonLaunchRequest[]>([]);

  const listQuery = useProjectComparisonList(projectId, page, PAGE_SIZE, true);
  const selectedComparisonId =
    selectedComparisonIdOverride ?? listQuery.data?.comparisons[0]?.id ?? null;
  const detailQuery = useProjectComparisonDetail(
    projectId,
    selectedComparisonId,
    selectedComparisonId != null
  );
  const candidatesQuery = useProjectComparisonCandidates(projectId, launchOpen);
  const launchMutation = useProjectComparisonLaunch(projectId);

  const pendingJobIds = useMemo(
    () => pendingLaunches.filter((launch) => hasLaunchStatus(launch, ACTIVE_LAUNCH_STATUSES)).map((launch) => launch.jobId),
    [pendingLaunches]
  );

  const pendingJobsQuery = useProjectComparisonPendingJobs(projectId, pendingJobIds, pendingJobIds.length > 0);
  const mergedPendingLaunches = useMemo(
    () => mergePendingLaunches(pendingLaunches, pendingJobsQuery.data),
    [pendingJobsQuery.data, pendingLaunches]
  );
  const activePendingLaunches = mergedPendingLaunches.filter((launch) =>
    hasLaunchStatus(launch, ACTIVE_LAUNCH_STATUSES)
  );

  const hasTerminalPendingJob = mergedPendingLaunches.some((launch) =>
    hasLaunchStatus(launch, TERMINAL_LAUNCH_STATUSES)
  );

  useEffect(() => {
    const error =
      listQuery.error ??
      detailQuery.error ??
      candidatesQuery.error ??
      launchMutation.error ??
      pendingJobsQuery.error;

    if (!error) {
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Comparison hub error',
      description: error.message,
    });
  }, [
    candidatesQuery.error,
    detailQuery.error,
    launchMutation.error,
    listQuery.error,
    pendingJobsQuery.error,
    toast,
  ]);

  async function handleLaunch() {
    try {
      const launch = await launchMutation.mutateAsync(selectedCandidateIds);
      setPendingLaunches((current) => [launch, ...current]);
      setSelectedCandidateIds([]);
      setLaunchOpen(false);
      setSelectedComparisonIdOverride(null);
    } catch {
      // Toast handled by effect above.
    }
  }

  useEffect(() => {
    if (!hasTerminalPendingJob) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: comparisonKeys.project(projectId) });
    void queryClient.invalidateQueries({
      queryKey: comparisonKeys.projectCandidates(projectId),
    });
  }, [hasTerminalPendingJob, projectId, queryClient]);

  const totalPages = listQuery.data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              <GitCompare className="h-4 w-4" />
              Saved comparisons
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Comparisons</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review durable comparison history for {projectName} and launch fresh comparisons from VERIFY.
            </p>
          </div>
          <Button type="button" onClick={() => setLaunchOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Compare VERIFY tickets
          </Button>
        </div>
      </section>

      {activePendingLaunches.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comparison in progress
          </div>
          <div className="mt-2">
            {activePendingLaunches.map((launch) => (
              <div key={launch.jobId}>
                {launch.selectedTicketKeys.join(', ')}: {launch.status}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-medium text-foreground">History</h2>
              <p className="text-sm text-muted-foreground">Newest comparisons first</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => void listQuery.refetch()}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          {listQuery.isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading project comparisons...</div>
          ) : (listQuery.data?.comparisons.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No saved comparisons yet. Launch one from VERIFY tickets to populate the hub.
            </div>
          ) : (
            <div className="space-y-3">
              {listQuery.data?.comparisons.map((comparison) => (
                <button
                  key={comparison.id}
                  type="button"
                  className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${
                    comparison.id === selectedComparisonId
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                  onClick={() => setSelectedComparisonIdOverride(comparison.id)}
                >
                  <div className="font-medium text-foreground">{comparison.winnerTicketKey}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{comparison.winnerTicketTitle}</div>
                  <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">{comparison.summary}</div>
                </button>
              ))}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {listQuery.data?.page ?? page}
                  {totalPages > 0 ? ` of ${totalPages}` : ''}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={totalPages === 0 || page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          {detailQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading comparison detail...</div>
          ) : detailQuery.data ? (
            <ComparisonDashboard detail={detailQuery.data} />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              Select a saved comparison to review the full dashboard inline.
            </div>
          )}
        </section>
      </div>

      <ProjectComparisonLaunchSheet
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        candidates={candidatesQuery.data?.candidates ?? []}
        selectedTicketIds={selectedCandidateIds}
        pendingLaunches={mergedPendingLaunches}
        isLoading={candidatesQuery.isLoading}
        isLaunching={launchMutation.isPending}
        onSelectionChange={setSelectedCandidateIds}
        onLaunch={handleLaunch}
      />
    </div>
  );
}
