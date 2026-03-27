'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronDown, GitCompare, Loader2, RefreshCcw, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ComparisonLaunchRequest, ProjectComparisonSummary } from '@/lib/types/comparison';
import {
  comparisonKeys,
  useProjectComparisonCandidates,
  useProjectComparisonDetail,
  useProjectComparisonInfiniteList,
  useProjectComparisonLaunch,
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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ComparisonCard({
  comparison,
  isExpanded,
  onToggle,
}: {
  comparison: ProjectComparisonSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-xl border px-5 py-4 text-left transition-colors ${
        isExpanded
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:bg-muted/40'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium text-foreground">{comparison.winnerTicketKey}</span>
            <span className="truncate text-sm text-muted-foreground">{comparison.winnerTicketTitle}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{comparison.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(comparison.generatedAt)}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
    </button>
  );
}

function ExpandedDetail({
  projectId,
  comparisonId,
}: {
  projectId: number;
  comparisonId: number;
}) {
  const detailQuery = useProjectComparisonDetail(projectId, comparisonId, true);

  if (detailQuery.isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading comparison detail...
      </div>
    );
  }

  if (!detailQuery.data) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Failed to load comparison detail.
      </div>
    );
  }

  return <ComparisonDashboard detail={detailQuery.data} />;
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
  const expandedRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);

  const infiniteQuery = useProjectComparisonInfiniteList(projectId, PAGE_SIZE, true);
  const allComparisons = useMemo(
    () => infiniteQuery.data?.pages.flatMap((page) => page.comparisons) ?? [],
    [infiniteQuery.data]
  );
  const total = infiniteQuery.data?.pages[0]?.total ?? 0;

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
      infiniteQuery.error ??
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
    infiniteQuery.error,
    launchMutation.error,
    pendingJobsQuery.error,
    toast,
  ]);

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

  useEffect(() => {
    if (!hasTerminalPendingJob) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: comparisonKeys.project(projectId) });
    void queryClient.invalidateQueries({
      queryKey: comparisonKeys.projectCandidates(projectId),
    });

    setPendingLaunches((current) =>
      current.filter((launch) => !hasLaunchStatus(launch, TERMINAL_LAUNCH_STATUSES))
    );
  }, [hasTerminalPendingJob, projectId, queryClient]);

  const handleToggle = useCallback((comparisonId: number) => {
    setExpandedId((current) => (current === comparisonId ? null : comparisonId));
  }, []);

  // Auto-scroll to deep-linked comparison on initial load
  useEffect(() => {
    if (
      initialComparisonId &&
      expandedId === initialComparisonId &&
      expandedRef.current &&
      !hasAutoScrolled.current
    ) {
      hasAutoScrolled.current = true;
      expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialComparisonId, expandedId, allComparisons]);

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
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => void infiniteQuery.refetch()}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button type="button" onClick={() => setLaunchOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Compare VERIFY tickets
            </Button>
          </div>
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

      {infiniteQuery.isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading project comparisons...</div>
      ) : allComparisons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No saved comparisons yet. Launch one from VERIFY tickets to populate the hub.
        </div>
      ) : (
        <div className="space-y-3">
          {allComparisons.map((comparison) => {
            const isExpanded = comparison.id === expandedId;
            return (
              <div
                key={comparison.id}
                ref={comparison.id === initialComparisonId ? expandedRef : undefined}
              >
                <ComparisonCard
                  comparison={comparison}
                  isExpanded={isExpanded}
                  onToggle={() => handleToggle(comparison.id)}
                />
                {isExpanded ? (
                  <div className="mt-3 rounded-2xl border border-border bg-card p-6">
                    <ExpandedDetail projectId={projectId} comparisonId={comparison.id} />
                  </div>
                ) : null}
              </div>
            );
          })}

          {infiniteQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={infiniteQuery.isFetchingNextPage}
                onClick={() => void infiniteQuery.fetchNextPage()}
              >
                {infiniteQuery.isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load more (${allComparisons.length} of ${total})`
                )}
              </Button>
            </div>
          ) : total > PAGE_SIZE ? (
            <p className="pt-2 text-center text-sm text-muted-foreground">
              All {total} comparisons loaded
            </p>
          ) : null}
        </div>
      )}

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
