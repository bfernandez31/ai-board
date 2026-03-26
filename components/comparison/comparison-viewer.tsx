'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, GitCompare, History, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useComparisonCheck,
  useComparisonDetail,
  useComparisonList,
} from '@/hooks/use-comparisons';
import { ComparisonComplianceGrid } from './comparison-compliance-grid';
import { ComparisonDecisionPoints } from './comparison-decision-points';
import { ComparisonHistoryList } from './comparison-history-list';
import { ComparisonMetricsGrid } from './comparison-metrics-grid';
import { ComparisonOperationalMetrics } from './comparison-operational-metrics';
import { ComparisonRanking } from './comparison-ranking';
import { MISSION_CONTROL_SECTION_ORDER, type ComparisonViewerProps } from './types';

export function ComparisonViewer({
  projectId,
  ticketId,
  initialComparisonId,
  onClose,
  isOpen,
}: ComparisonViewerProps) {
  const [selectedComparisonIdOverride, setSelectedComparisonIdOverride] = useState<
    number | null
  >(null);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  const { data: checkData, isLoading: checkLoading, error: checkError } =
    useComparisonCheck(projectId, ticketId, isOpen);
  const { data: historyData, isLoading: historyLoading } = useComparisonList(
    projectId,
    ticketId,
    10,
    isOpen
  );

  const selectedComparisonId =
    selectedComparisonIdOverride ?? initialComparisonId ?? checkData?.latestComparisonId ?? null;

  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
  } = useComparisonDetail(
    projectId,
    ticketId,
    selectedComparisonId,
    isOpen && selectedComparisonId != null
  );

  useEffect(() => {
    if (!isOpen || (!checkError && !detailError)) {
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Error',
      description: checkError?.message || detailError?.message || 'Failed to load comparison',
    });
  }, [checkError, detailError, isOpen, toast]);

  function handleOpenChange(open: boolean): void {
    if (!open) {
      setShowHistory(false);
      setSelectedComparisonIdOverride(null);
      onClose?.();
    }
  }

  const isLoading = checkLoading || detailLoading;
  const hasNoComparisons = checkData && !checkData.hasComparisons;
  const loadErrorMessage = checkError?.message || detailError?.message;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl bg-card text-card-foreground sm:max-w-[90vw]">
        <DialogHeader className="pr-12">
          <DialogDescription className="sr-only">
            Review saved comparison history and structured dashboard details for this ticket.
          </DialogDescription>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Ticket Comparison
            </DialogTitle>
            {checkData && checkData.count > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowHistory((value) => !value)}
              >
                <History className="mr-2 h-4 w-4" />
                {showHistory ? 'Hide history' : `History (${checkData.count})`}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="mt-2">
          {isLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading comparison...
            </div>
          )}

          {hasNoComparisons && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No comparisons available</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Use `@ai-board /compare` in a comment to create one.
              </p>
            </div>
          )}

          {(checkError || detailError) && !detail && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="mb-4 h-12 w-12 text-destructive" />
              <p className="text-lg font-medium">Error loading comparison</p>
              <p className="mt-2 text-sm text-muted-foreground">{loadErrorMessage}</p>
            </div>
          )}

          {!hasNoComparisons && !isLoading && (
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className={showHistory ? 'block' : 'hidden lg:block'}>
                <ComparisonHistoryList
                  comparisons={historyData?.comparisons ?? []}
                  selectedComparisonId={selectedComparisonId}
                  isLoading={historyLoading}
                  onSelect={(comparisonId) => {
                    setSelectedComparisonIdOverride(comparisonId);
                    setShowHistory(false);
                  }}
                />
              </div>

              <div>
                {detail ? (
                  <ScrollArea className="h-[72vh] pr-4">
                    <div className="space-y-4 pb-2" data-section-order={MISSION_CONTROL_SECTION_ORDER.join(',')}>
                      <ComparisonRanking
                        participants={detail.participants}
                        recommendation={detail.overallRecommendation}
                        summary={detail.summary}
                        winnerTicketId={detail.winnerTicketId}
                        keyDifferentiators={detail.keyDifferentiators}
                        generatedAt={detail.generatedAt}
                        sourceTicketKey={detail.sourceTicketKey}
                        winnerTicketKey={detail.winnerTicketKey}
                        headlineMetrics={detail.headlineMetrics}
                      />
                      <ComparisonMetricsGrid participants={detail.participants} />
                      <ComparisonOperationalMetrics
                        participants={detail.participants}
                        metricRows={detail.metricMatrix}
                      />
                      <ComparisonDecisionPoints decisionPoints={detail.decisionPoints} />
                      <ComparisonComplianceGrid
                        rows={detail.complianceRows}
                        participants={detail.participants}
                      />
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Select a saved comparison to view the dashboard.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
