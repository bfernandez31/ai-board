'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GitCompare, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ComparisonLaunchRequest } from '@/lib/types/comparison';
import {
  comparisonKeys,
  useProjectComparisonCandidates,
  useProjectComparisonDetail,
  useProjectComparisonLaunch,
  useProjectComparisonListInfinite,
  useProjectComparisonPendingJobs,
} from '@/hooks/use-comparisons';
import { ComparisonCard } from './comparison-card';
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
  initialComparisonId = null,
}: ProjectComparisonsPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(initialComparisonId);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [pendingLaunches, setPendingLaunches] = useState<ComparisonLaunchRequest[]>([]);
  const deepLinkAttemptedRef = useRef(false);
  const deepLinkCardRef = useRef<HTMLDivElement | null>(null);

  const infiniteQuery = useProjectComparisonListInfinite(projectId, PAGE_SIZE, true);
  const comparisons = useMemo(
    () => infiniteQuery.data?.comparisons ?? [],
    [infiniteQuery.data?.comparisons]
  );

  const detailQuery = useProjectComparisonDetail(
    projectId,
    expandedId,
    expandedId != null
  );
  const candidatesQuery = useProjectComparisonCandidates(projectId, launchOpen);
  const launchMutation = useProjectComparisonLaunch(projectId);

  const pendingJobIds = useMemo(
    () =>
      pendingLaunches
        .filter((launch) => hasLaunchStatus(launch, ACTIVE_LAUNCH_STATUSES))
        .map((launch) => launch.jobId),
    [pendingLaunches]
  );

  const pendingJobsQuery = useProjectComparisonPendingJobs(
    projectId,
    pendingJobIds,
    pendingJobIds.length > 0
  );
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

  // Error toast
  useEffect(() => {
    const error =
      infiniteQuery.error ??
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
    infiniteQuery.error,
    launchMutation.error,
    pendingJobsQuery.error,
    toast,
  ]);

  // Handle terminal pending jobs
  useEffect(() => {
    if (!hasTerminalPendingJob) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: comparisonKeys.project(projectId) });
    void queryClient.invalidateQueries({
      queryKey: comparisonKeys.projectCandidates(projectId),
    });
    void infiniteQuery.refetch();

    setPendingLaunches((current) =>
      current.filter((launch) => !hasLaunchStatus(launch, TERMINAL_LAUNCH_STATUSES))
    );
  }, [hasTerminalPendingJob, projectId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link auto-expand: fetch pages until target comparison is found
  useEffect(() => {
    if (
      !initialComparisonId ||
      deepLinkAttemptedRef.current ||
      infiniteQuery.isLoading ||
      infiniteQuery.isFetchingNextPage
    ) {
      return;
    }

    const found = comparisons.some((c) => c.id === initialComparisonId);
    if (found) {
      deepLinkAttemptedRef.current = true;
      return;
    }

    if (infiniteQuery.hasNextPage) {
      void infiniteQuery.fetchNextPage();
    } else {
      // All pages exhausted, target not found — degrade gracefully
      deepLinkAttemptedRef.current = true;
    }
  }, [initialComparisonId, comparisons, infiniteQuery.isLoading, infiniteQuery.isFetchingNextPage, infiniteQuery.hasNextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll deep-linked card into view
  useEffect(() => {
    if (!initialComparisonId || !deepLinkCardRef.current) {
      return;
    }

    const found = comparisons.some((c) => c.id === initialComparisonId);
    if (found && expandedId === initialComparisonId) {
      deepLinkCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialComparisonId, expandedId, comparisons]);

  const handleToggle = useCallback(
    (comparisonId: number) => {
      setExpandedId((current) => (current === comparisonId ? null : comparisonId));
    },
    []
  );

  async function handleLaunch() {
    try {
      const launch = await launchMutation.mutateAsync(selectedCandidateIds);
      setPendingLaunches((current) => [launch, ...current]);
      setSelectedCandidateIds([]);
      setLaunchOpen(false);
      setExpandedId(null);
    } catch {
      // Toast handled by effect above.
    }
  }

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

      {activePendingLaunches.length > 0 && (
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
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-foreground">History</h2>
            <p className="text-sm text-muted-foreground">Newest comparisons first</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void infiniteQuery.refetch()}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {infiniteQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading project comparisons...
          </div>
        ) : comparisons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No saved comparisons yet. Launch one from VERIFY tickets to populate the hub.
          </div>
        ) : (
          <div className="space-y-3">
            {comparisons.map((comparison) => (
              <div
                key={comparison.id}
                ref={comparison.id === initialComparisonId ? deepLinkCardRef : undefined}
              >
                <ComparisonCard
                  comparison={comparison}
                  isExpanded={comparison.id === expandedId}
                  detail={comparison.id === expandedId ? detailQuery.data ?? undefined : undefined}
                  isDetailLoading={comparison.id === expandedId && detailQuery.isLoading}
                  onToggle={() => handleToggle(comparison.id)}
                />
              </div>
            ))}

            {infiniteQuery.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void infiniteQuery.fetchNextPage()}
                  disabled={infiniteQuery.isFetchingNextPage}
                >
                  {infiniteQuery.isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

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
