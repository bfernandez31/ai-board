'use client';

import { useEffect, useState } from 'react';
import { Layers, Files, GitPullRequest, AlertCircle, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrDiff, PrDiffError } from '@/lib/hooks/use-pr-diff';
import { getScoreColor } from '@/lib/quality-score';
import { PrFileDiff } from '@/components/ticket/pr-file-diff';
import type { FileChange, PrOverview, ResolvedLayer } from '@/app/lib/schemas/pr-diff';

interface PrDiffViewerProps {
  projectId: number;
  ticketId: number;
  ticketTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RailMode = 'layers' | 'files';

function FileList({ files }: { files: FileChange[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No files in this view</p>;
  }
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <PrFileDiff key={file.filename} file={file} />
      ))}
    </div>
  );
}

/**
 * Resolve the main-panel content from the current rail state: Overview takes
 * precedence, then Files mode shows the flat list, otherwise the selected layer's
 * files (falling back to the flat list when no layer is selected).
 */
function MainPanel({
  showOverview,
  overview,
  mode,
  files,
  selectedLayer,
}: {
  showOverview: boolean;
  overview: PrOverview;
  mode: RailMode;
  files: FileChange[];
  selectedLayer: ResolvedLayer | null;
}) {
  if (showOverview) return <OverviewPanel overview={overview} />;
  if (mode === 'files') return <FileList files={files} />;
  return <FileList files={selectedLayer?.files ?? files} />;
}

function OverviewPanel({ overview }: { overview: PrOverview }) {
  const score = overview.qualityScore;
  const colors = score != null ? getScoreColor(score) : null;

  return (
    <div className="space-y-4" data-testid="pr-overview">
      <div className="flex items-center gap-2 flex-wrap">
        <GitPullRequest className="h-5 w-5 text-ctp-mauve" />
        <h3 className="text-lg font-semibold text-zinc-50">
          {overview.pr?.title ?? 'Pull request'}
        </h3>
        {overview.pr && (
          <Badge className="bg-ctp-sapphire/15 text-ctp-sapphire capitalize">{overview.pr.state}</Badge>
        )}
      </div>

      {overview.pr && (
        <a
          href={overview.pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
        >
          View PR #{overview.pr.number} on GitHub
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {score != null && colors && (
        <div className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 ${colors.bg}`}>
          <span className="text-sm text-muted-foreground">Quality score</span>
          <span className={`text-sm font-semibold ${colors.text}`}>{score}</span>
          {overview.qualityThreshold && (
            <span className={`text-xs ${colors.text}`}>({overview.qualityThreshold})</span>
          )}
        </div>
      )}

      {overview.reviewSynthesis && (
        <div className="bg-zinc-900 rounded-lg p-4" data-testid="review-synthesis">
          <p className="text-sm text-zinc-200 whitespace-pre-wrap">{overview.reviewSynthesis}</p>
        </div>
      )}
    </div>
  );
}

/**
 * PrDiffViewer — full-screen read-only viewer for a ticket's PR diff (AIB-879).
 * Side rail with an Overview entry and a Layers ↔ Files toggle; layers render in
 * dependency order with file/comment counters, selecting one shows its files;
 * Files mode shows the flat list. Never errors out: no-PR, auth-required, and
 * never-reviewed (defaults to Files) states render gracefully.
 */
export function PrDiffViewer({ projectId, ticketId, ticketTitle, open, onOpenChange }: PrDiffViewerProps) {
  const { data, isLoading, error } = usePrDiff(projectId, ticketId, { enabled: open });

  const [mode, setMode] = useState<RailMode>('layers');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  // Open on the diff content (Overview reachable via its rail button), so the
  // viewer immediately shows the change rather than a summary.
  const [showOverview, setShowOverview] = useState(false);

  // Initialise rail state when data arrives: never-reviewed (no layers) → Files mode.
  useEffect(() => {
    if (!data) return;
    if (data.layers.length === 0) {
      setMode('files');
      setSelectedLayerId(null);
    } else {
      setMode('layers');
      setSelectedLayerId(data.layers[0]!.id);
    }
    setShowOverview(false);
  }, [data]);

  const layers: ResolvedLayer[] = data?.layers ?? [];
  const hasLayers = layers.length > 0;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] sm:max-w-[92vw]">
        <DialogHeader className="pr-12">
          <DialogTitle className="text-zinc-50">PR Diff — {ticketTitle}</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex gap-4 mt-4" data-testid="pr-diff-loading">
            <div className="w-64 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
            <div className="flex-1 space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="py-12 text-center" data-testid="pr-diff-error">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-ctp-yellow" />
            {error instanceof PrDiffError && error.code === 'AUTH_REQUIRED' ? (
              <>
                <p className="text-zinc-200 font-medium">GitHub authorization required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reconnect your GitHub account with repository access to view this PR diff.
                </p>
              </>
            ) : (
              <>
                <p className="text-zinc-200 font-medium">Couldn&apos;t load the PR diff</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Please try again.'}
                </p>
              </>
            )}
          </div>
        )}

        {!isLoading && !error && data && !data.pr && (
          <div className="py-12 text-center" data-testid="pr-diff-no-pr">
            <GitPullRequest className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-60" />
            <p className="text-zinc-200 font-medium">No PR available</p>
            <p className="text-sm text-muted-foreground mt-1">
              This ticket doesn&apos;t have an open pull request yet.
            </p>
          </div>
        )}

        {!isLoading && !error && data && data.pr && (
          <div className="flex gap-4 mt-4 min-h-0">
            {/* Side rail */}
            <div className="w-64 shrink-0 flex flex-col gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOverview(true)}
                aria-pressed={showOverview}
                className={showOverview ? 'border-ctp-mauve/50 text-ctp-mauve' : ''}
              >
                Overview
              </Button>

              {/* Layers ↔ Files toggle */}
              <div className="flex gap-1" role="group" aria-label="View mode">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasLayers}
                  aria-pressed={mode === 'layers' && !showOverview}
                  onClick={() => {
                    setMode('layers');
                    setShowOverview(false);
                    setSelectedLayerId(layers[0]?.id ?? null);
                  }}
                  className="flex-1"
                >
                  <Layers className="h-3.5 w-3.5 mr-1" />
                  Layers
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={mode === 'files' && !showOverview}
                  onClick={() => {
                    setMode('files');
                    setShowOverview(false);
                  }}
                  className="flex-1"
                >
                  <Files className="h-3.5 w-3.5 mr-1" />
                  Files
                </Button>
              </div>

              {/* Layer list (Layers mode) */}
              {mode === 'layers' && hasLayers && (
                <ScrollArea className="flex-1 max-h-[60vh]">
                  <div className="space-y-1 pr-2" role="listbox" aria-label="Layers">
                    {layers.map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          setSelectedLayerId(layer.id);
                          setShowOverview(false);
                        }}
                        aria-selected={!showOverview && selectedLayerId === layer.id}
                        className={`w-full text-left rounded-md px-3 py-2 border transition-colors ${
                          !showOverview && selectedLayerId === layer.id
                            ? 'border-ctp-mauve/50 bg-ctp-mauve/10'
                            : 'border-zinc-700 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-100 truncate">{layer.title}</span>
                          {layer.synthetic && (
                            <Badge className="bg-zinc-700 text-zinc-300 text-[10px] px-1.5 py-0 shrink-0">
                              extra
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{layer.summary}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span>{layer.fileCount} files</span>
                          <span>{layer.commentCount} comments</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Main panel */}
            <ScrollArea className="flex-1 max-h-[70vh]">
              <div className="pr-4">
                {data.truncated && (
                  <div
                    className="mb-3 rounded-md border border-ctp-yellow/30 bg-ctp-yellow/10 px-3 py-2 text-xs text-ctp-yellow"
                    data-testid="pr-diff-truncated"
                  >
                    This PR is large — some files or diffs were truncated for performance.
                  </div>
                )}

                <MainPanel
                  showOverview={showOverview}
                  overview={data.overview}
                  mode={mode}
                  files={data.files}
                  selectedLayer={selectedLayer}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
