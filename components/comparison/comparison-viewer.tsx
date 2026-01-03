/**
 * ComparisonViewer Component
 *
 * Modal viewer for displaying ticket comparison reports.
 * Features:
 * - TanStack Query for caching and state management
 * - Renders markdown comparison reports with syntax highlighting
 * - Loading and error states
 * - Scrollable content for large reports
 * - Alignment score badge and metadata display
 */

'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GitCompare, History, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useComparisonCheck,
  useComparisonList,
  useComparisonReport,
} from '@/hooks/use-comparisons';
import type { ComparisonViewerProps } from './types';

/**
 * Get alignment badge variant based on score
 */
function getAlignmentVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 70) return 'default';
  if (score >= 30) return 'secondary';
  return 'destructive';
}

/**
 * Format date for display
 */
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

/**
 * ComparisonViewer Component
 *
 * Displays comparison reports in a modal dialog.
 */
export function ComparisonViewer({
  projectId,
  ticketId,
  selectedReport,
  onClose,
  isOpen,
}: ComparisonViewerProps) {
  const [currentReport, setCurrentReport] = useState<string | undefined>(selectedReport);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  // Check if comparisons exist
  const {
    data: checkData,
    isLoading: checkLoading,
    error: checkError,
  } = useComparisonCheck(projectId, ticketId, isOpen);

  // Fetch comparison list for history
  const {
    data: listData,
    isLoading: listLoading,
  } = useComparisonList(projectId, ticketId, 10, isOpen && showHistory);

  // Determine which report to fetch
  const reportToFetch = currentReport || checkData?.latestReport || undefined;

  // Fetch the comparison report content
  const {
    data: reportData,
    isLoading: reportLoading,
    error: reportError,
  } = useComparisonReport(
    projectId,
    ticketId,
    reportToFetch || '',
    isOpen && !!reportToFetch
  );

  // Update current report when selectedReport prop changes
  useEffect(() => {
    if (selectedReport) {
      setCurrentReport(selectedReport);
    }
  }, [selectedReport]);

  // Set current report to latest when check data arrives
  useEffect(() => {
    if (checkData?.latestReport && !currentReport) {
      setCurrentReport(checkData.latestReport);
    }
  }, [checkData, currentReport]);

  // Show error toast
  useEffect(() => {
    if ((checkError || reportError) && isOpen) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: checkError?.message || reportError?.message || 'Failed to load comparison',
      });
    }
  }, [checkError, reportError, isOpen, toast]);

  // Reset state when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowHistory(false);
      setCurrentReport(undefined);
      onClose?.();
    }
  };

  const isLoading = checkLoading || reportLoading;
  const hasNoComparisons = checkData && !checkData.hasComparisons;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-w-[90vw] bg-zinc-950">
        <DialogHeader className="pr-12">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-zinc-50 flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Ticket Comparison
            </DialogTitle>

            {/* Action buttons */}
            {reportData && !showHistory && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Best score badge */}
                <Badge variant={getAlignmentVariant(reportData.metadata.alignmentScore)}>
                  {reportData.metadata.alignmentScore}% Best
                </Badge>

                {/* History button */}
                {checkData && checkData.count > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(true)}
                    className="shrink-0"
                  >
                    <History className="h-4 w-4 mr-2" />
                    History ({checkData.count})
                  </Button>
                )}
              </div>
            )}

            {/* Back button when viewing history */}
            {showHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(false)}
                className="shrink-0"
              >
                Back to Report
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="mt-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-zinc-400">Loading comparison...</div>
            </div>
          )}

          {/* No comparisons state */}
          {hasNoComparisons && !isLoading && (
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

          {/* Report content */}
          {reportData && !showHistory && (
            <>
              {/* Metadata bar */}
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

              {/* Report markdown content */}
              <ScrollArea className="h-[60vh] w-full rounded-md pr-4">
                <div className="prose prose-invert max-w-none bg-zinc-900 p-6 rounded-lg">
                  <ReactMarkdown
                    className="text-zinc-100"
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1
                          className="text-3xl font-bold mb-4 text-zinc-50"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className="text-2xl font-semibold mb-3 mt-6 text-zinc-50"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className="text-xl font-semibold mb-2 mt-4 text-zinc-100"
                          {...props}
                        />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4
                          className="text-lg font-semibold mb-2 mt-3 text-zinc-100"
                          {...props}
                        />
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
                        <a
                          className="text-blue-400 hover:text-blue-300 underline"
                          {...props}
                        />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="border-l-4 border-zinc-600 pl-4 italic text-zinc-400 my-4"
                          {...props}
                        />
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
                          <code
                            className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-zinc-100 font-mono"
                            {...props}
                          >
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

          {/* History view */}
          {showHistory && (
            <div className="h-[60vh] flex flex-col">
              <h3 className="text-lg font-semibold text-zinc-50 mb-4">
                Comparison History
              </h3>

              {listLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-zinc-400">Loading history...</div>
                </div>
              ) : listData?.comparisons && listData.comparisons.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {listData.comparisons.map((comparison) => (
                      <button
                        key={comparison.filename}
                        onClick={() => {
                          setCurrentReport(comparison.filename);
                          setShowHistory(false);
                        }}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          currentReport === comparison.filename
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <GitCompare className="h-4 w-4 text-zinc-400" />
                            <span className="text-zinc-200 font-medium">
                              vs {comparison.comparedTickets.join(', ')}
                            </span>
                          </div>
                          <Badge variant={getAlignmentVariant(comparison.alignmentScore)}>
                            {comparison.alignmentScore}%
                          </Badge>
                        </div>
                        <div className="text-sm text-zinc-500">
                          {formatDate(comparison.generatedAt)}
                        </div>
                        {currentReport === comparison.filename && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-blue-400">
                            <CheckCircle className="h-3 w-3" />
                            Currently viewing
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <History className="h-12 w-12 mb-4 opacity-50" />
                  <p>No comparison history available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComparisonViewer;
