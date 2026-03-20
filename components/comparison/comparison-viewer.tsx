/**
 * ComparisonViewer Component
 *
 * Modal viewer for displaying ticket comparison reports.
 * Features:
 * - Dashboard view for stored comparisons (rich visual)
 * - Markdown view for file-based reports (legacy)
 * - TanStack Query for caching and state management
 * - Loading and error states
 */

'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GitCompare, History, AlertTriangle, CheckCircle, XCircle, LayoutDashboard, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useComparisonCheck,
  useComparisonList,
  useComparisonReport,
} from '@/hooks/use-comparisons';
import {
  useStoredComparisons,
  useEnrichedComparison,
} from '@/hooks/use-stored-comparisons';
import { ComparisonDashboard } from './comparison-dashboard';
import type { ComparisonViewerProps } from './types';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ViewMode = 'dashboard' | 'report' | 'history';

export function ComparisonViewer({
  projectId,
  ticketId,
  ticketKey,
  selectedReport,
  onClose,
  isOpen,
}: ComparisonViewerProps) {
  const [reportOverride, setReportOverride] = useState<string | undefined>();
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const [selectedStoredId, setSelectedStoredId] = useState<number | null>(null);
  const { toast } = useToast();

  // File-based comparisons
  const {
    data: checkData,
    isLoading: checkLoading,
    error: checkError,
  } = useComparisonCheck(projectId, ticketId, isOpen);

  // Stored comparisons
  const {
    data: storedData,
    isLoading: storedLoading,
  } = useStoredComparisons(projectId, ticketKey, 20, isOpen && !!ticketKey);

  // Derive view mode: user override takes precedence, then auto-select based on data
  function getDefaultViewMode(): ViewMode {
    if (storedData?.comparisons && storedData.comparisons.length > 0) return 'dashboard';
    if (checkData?.hasComparisons) return 'report';
    return 'dashboard';
  }
  const viewMode = viewModeOverride ?? getDefaultViewMode();

  const {
    data: listData,
    isLoading: listLoading,
  } = useComparisonList(projectId, ticketId, 10, isOpen && viewMode === 'history');

  const currentReport = reportOverride ?? selectedReport ?? checkData?.latestReport;

  const {
    data: reportData,
    isLoading: reportLoading,
    error: reportError,
  } = useComparisonReport(
    projectId,
    ticketId,
    currentReport || '',
    isOpen && !!currentReport && viewMode === 'report'
  );

  const activeStoredId = selectedStoredId ?? (storedData?.comparisons?.[0]?.id ?? null);

  const {
    data: enrichedData,
    isLoading: enrichedLoading,
  } = useEnrichedComparison(
    projectId,
    activeStoredId ?? 0,
    isOpen && activeStoredId != null && viewMode === 'dashboard'
  );

  useEffect(() => {
    if ((checkError || reportError) && isOpen) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: checkError?.message || reportError?.message || 'Failed to load comparison',
      });
    }
  }, [checkError, reportError, isOpen, toast]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setViewModeOverride(null);
      setReportOverride(undefined);
      setSelectedStoredId(null);
      onClose?.();
    }
  };

  const hasStoredComparisons = storedData?.comparisons && storedData.comparisons.length > 0;
  const hasFileComparisons = checkData?.hasComparisons;
  const isLoading = checkLoading || storedLoading;
  const hasNoComparisons = !hasStoredComparisons && checkData && !checkData.hasComparisons && !isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-w-[90vw] bg-zinc-950">
        <DialogHeader className="pr-12">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-zinc-50 flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Ticket Comparison
            </DialogTitle>

            <div className="flex items-center gap-2">
              {/* View mode toggle - show both when both types exist */}
              {hasStoredComparisons && hasFileComparisons && viewMode !== 'history' && (
                <>
                  <Button
                    variant={viewMode === 'dashboard' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewModeOverride('dashboard')}
                    className="shrink-0"
                  >
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                  <Button
                    variant={viewMode === 'report' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewModeOverride('report')}
                    className="shrink-0"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Report
                  </Button>
                </>
              )}

              {/* History button for stored comparisons */}
              {hasStoredComparisons && storedData!.comparisons.length > 1 && viewMode === 'dashboard' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewModeOverride('history')}
                  className="shrink-0"
                >
                  <History className="h-4 w-4 mr-2" />
                  History ({storedData!.comparisons.length})
                </Button>
              )}

              {/* History button for file comparisons */}
              {viewMode === 'report' && reportData && checkData && checkData.count > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewModeOverride('history')}
                  className="shrink-0"
                >
                  <History className="h-4 w-4 mr-2" />
                  History ({checkData.count})
                </Button>
              )}

              {/* Back button from history */}
              {viewMode === 'history' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewModeOverride(hasStoredComparisons ? 'dashboard' : 'report')}
                  className="shrink-0"
                >
                  Back
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {/* Loading state */}
          {(isLoading || (viewMode === 'dashboard' && enrichedLoading) || (viewMode === 'report' && reportLoading)) && (
            <div className="flex items-center justify-center py-8">
              <div className="text-zinc-400">Loading comparison...</div>
            </div>
          )}

          {/* No comparisons state */}
          {hasNoComparisons && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No Comparisons Available</p>
              <p className="text-sm mt-2 text-zinc-500">
                Use @ai-board /compare in a comment to generate a comparison report.
              </p>
            </div>
          )}

          {/* Error state */}
          {(checkError || reportError) && !reportData && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-red-400">
              <XCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Error Loading Comparison</p>
              <p className="text-sm mt-2 text-zinc-500">
                {checkError?.message || reportError?.message}
              </p>
            </div>
          )}

          {/* Dashboard view (stored comparisons) */}
          {viewMode === 'dashboard' && enrichedData && !enrichedLoading && (
            <ComparisonDashboard comparison={enrichedData} />
          )}

          {/* Report view (file-based markdown) */}
          {viewMode === 'report' && reportData && !reportLoading && (
            <>
              <div className="flex flex-wrap gap-4 mb-4 text-sm text-zinc-400">
                <div>
                  <span className="text-zinc-500">Source:</span>{' '}
                  <span className="text-zinc-200">{reportData.metadata.sourceTicket}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Compared:</span>{' '}
                  <span className="text-zinc-200">
                    {reportData.metadata.comparedTickets.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Generated:</span>{' '}
                  <span className="text-zinc-200">
                    {formatDate(reportData.metadata.generatedAt)}
                  </span>
                </div>
              </div>

              <ScrollArea className="h-[60vh] w-full rounded-md pr-4">
                <div className="prose prose-invert max-w-none bg-zinc-900 p-6 rounded-lg">
                  <ReactMarkdown
                    className="text-zinc-100"
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-3xl font-bold mb-4 text-zinc-50" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-2xl font-semibold mb-3 mt-6 text-zinc-50" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xl font-semibold mb-2 mt-4 text-zinc-100" {...props} />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4 className="text-lg font-semibold mb-2 mt-3 text-zinc-100" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 text-zinc-200 leading-relaxed" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc ml-6 mb-4 text-zinc-200" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal ml-6 mb-4 text-zinc-200" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="mb-1 text-zinc-200" {...props} />
                      ),
                      a: ({ node, ...props }) => (
                        <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-zinc-600 pl-4 italic text-zinc-400 my-4" {...props} />
                      ),
                      code: ({ node, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const inline = !className;
                        return !inline && match ? (
                          <SyntaxHighlighter
                            /* @ts-expect-error - vscDarkPlus type mismatch with react-syntax-highlighter */
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md my-4"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-zinc-100 font-mono" {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ node, ...props }) => (
                        <pre className="bg-zinc-900 rounded-md p-4 overflow-x-auto my-4" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border border-zinc-700" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-zinc-800" {...props} />
                      ),
                      tbody: ({ node, ...props }) => (
                        <tbody {...props} />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr className="border-b border-zinc-700" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th className="px-4 py-2 text-left text-zinc-50 font-semibold" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2 text-zinc-200" {...props} />
                      ),
                      hr: ({ node, ...props }) => (
                        <hr className="border-zinc-700 my-6" {...props} />
                      ),
                    }}
                  >
                    {reportData.content}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </>
          )}

          {/* History view - shows both stored and file-based comparisons */}
          {viewMode === 'history' && (
            <div className="h-[60vh] flex flex-col">
              <h3 className="text-lg font-semibold text-zinc-50 mb-4">
                Comparison History
              </h3>

              {listLoading || storedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-zinc-400">Loading history...</div>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {/* Stored comparisons */}
                    {storedData?.comparisons?.map((comparison) => (
                      <button
                        key={`stored-${comparison.id}`}
                        onClick={() => {
                          setSelectedStoredId(comparison.id);
                          setViewModeOverride('dashboard');
                        }}
                        className="w-full text-left p-4 rounded-lg border transition-colors border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <LayoutDashboard className="h-4 w-4 text-ctp-green" />
                          <span className="text-zinc-200 font-medium">
                            {comparison.entries.map((e) => e.ticketKey).join(' vs ')}
                          </span>
                          {comparison.winnerTicketKey && (
                            <span className="text-xs text-ctp-green">
                              Winner: {comparison.winnerTicketKey}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-500">
                          {formatDate(comparison.createdAt)}
                        </div>
                      </button>
                    ))}

                    {/* File-based comparisons */}
                    {listData?.comparisons?.map((comparison) => (
                      <button
                        key={comparison.filename}
                        onClick={() => {
                          setReportOverride(comparison.filename);
                          setViewModeOverride('report');
                        }}
                        className="w-full text-left p-4 rounded-lg border transition-colors border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-zinc-400" />
                          <span className="text-zinc-200 font-medium">
                            vs {comparison.comparedTickets.join(', ')}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-500">
                          {formatDate(comparison.generatedAt)}
                        </div>
                        {currentReport === comparison.filename && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-blue-400">
                            <CheckCircle className="h-3 w-3" />
                            Last viewed
                          </div>
                        )}
                      </button>
                    ))}

                    {/* Empty state */}
                    {(!storedData?.comparisons?.length && !listData?.comparisons?.length) && (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                        <History className="h-12 w-12 mb-4 opacity-50" />
                        <p>No comparison history available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
