'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Pencil, History } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useDocumentation } from '@/lib/hooks/use-documentation';
import { useDocumentationHistory, useDocumentationDiff } from '@/lib/hooks/use-documentation-history';
import { canEdit } from '@/components/ticket/edit-permission-guard';
import { DocumentationEditor } from '@/components/ticket/documentation-editor';
import { CommitHistoryViewer } from '@/components/ticket/commit-history-viewer';
import { DiffViewer } from '@/components/ticket/diff-viewer';
import type { DocumentType } from '@/lib/validations/documentation';
import type { Stage } from '@prisma/client';

/**
 * Human-readable labels for documentation types
 */
const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
  summary: 'Implementation Summary',
};

interface DocumentationViewerProps {
  /** Ticket ID */
  ticketId: number;

  /** Project ID */
  projectId: number;

  /** Ticket title for display in modal header */
  ticketTitle: string;

  /** Ticket stage for permission checking */
  ticketStage: Stage;

  /** Document type to display (spec, plan, or tasks) */
  docType: DocumentType;

  /** Whether the modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * DocumentationViewer Component
 *
 * Generic viewer for documentation files (spec.md, plan.md, tasks.md).
 * Features:
 * - TanStack Query for caching and state management
 * - Renders markdown with syntax highlighting
 * - Loading and error states
 * - Scrollable content for large documents
 * - Responsive design for mobile
 */
export default function DocumentationViewer({
  ticketId,
  projectId,
  ticketTitle,
  ticketStage,
  docType,
  open,
  onOpenChange,
}: DocumentationViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch documentation using TanStack Query hook
  // Only fetches when modal is open (enabled=open)
  const { data, isLoading, error } = useDocumentation(
    projectId,
    ticketId,
    docType,
    open
  );

  // Fetch commit history (only when viewing history)
  const { data: historyData, isLoading: historyLoading, error: historyError } = useDocumentationHistory(
    projectId,
    ticketId,
    docType,
    isViewingHistory
  );

  // Fetch diff for selected commit
  const { data: diffData, isLoading: diffLoading } = useDocumentationDiff(
    projectId,
    ticketId,
    docType,
    selectedCommitSha
  );

  // Check if user can edit this document type based on ticket stage
  const userCanEdit = canEdit(ticketStage, docType);

  // Show error toast when error occurs (in useEffect to avoid state update during render)
  useEffect(() => {
    if (error && open) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch documentation',
      });
    }
  }, [error, open, toast]);

  // Reset edit mode and history view when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsEditing(false);
      setIsViewingHistory(false);
      setSelectedCommitSha(null);
    }
    onOpenChange(newOpen);
  };

  const handleSaveSuccess = () => {
    toast({
      title: 'Success',
      description: `${docType}.md saved successfully`,
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-w-[90vw]">
        <DialogHeader className="pr-12">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-zinc-50 flex-1">
              {DocumentTypeLabels[docType]} - Ticket #{ticketId}: {ticketTitle}
            </DialogTitle>

            {/* Action buttons - only show when not editing or viewing history */}
            {!isEditing && !isViewingHistory && data && !isLoading && (
              <div className="flex items-center gap-2 shrink-0">
                {/* View History button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsViewingHistory(true)}
                  className="shrink-0"
                >
                  <History className="h-4 w-4 mr-2" />
                  View History
                </Button>

                {/* Edit button - only show if user can edit */}
                {userCanEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="shrink-0"
                    data-testid="edit-button"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            )}

            {/* Back button when viewing history */}
            {isViewingHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsViewingHistory(false);
                  setSelectedCommitSha(null);
                }}
                className="shrink-0"
              >
                Back to Document
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">
                Loading {docType}...
              </div>
            </div>
          )}

          {error && !data && (
            <div className="text-red-400 py-4">
              <p>Error: {error.message}</p>
            </div>
          )}

          {data && !isEditing && !isViewingHistory && (
            <ScrollArea className="h-[60vh] w-full rounded-md pr-4">
              <div className="prose prose-invert max-w-none bg-zinc-900 p-6 rounded-lg">
                <ReactMarkdown
                  className="text-zinc-100"
                  remarkPlugins={[remarkGfm]}
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
                    h5: ({ node, ...props }) => (
                      <h5
                        className="text-base font-semibold mb-1 mt-2 text-zinc-200"
                        {...props}
                      />
                    ),
                    h6: ({ node, ...props }) => (
                      <h6
                        className="text-sm font-semibold mb-1 mt-2 text-zinc-200"
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
                        className="border-l-4 border-zinc-600 pl-4 italic text-muted-foreground my-4"
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
                  {data.content}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          )}

          {/* Editor mode - show when editing (summary is read-only, never edited) */}
          {data && isEditing && docType !== 'summary' && (
            <div className="h-[70vh] flex flex-col">
              <DocumentationEditor
                projectId={projectId}
                ticketId={ticketId}
                docType={docType}
                initialContent={data.content}
                onCancel={() => setIsEditing(false)}
                onSaveSuccess={handleSaveSuccess}
              />
            </div>
          )}

          {/* History view - show when viewing history */}
          {isViewingHistory && (
            <div className="h-[70vh] flex flex-col gap-6">
              {/* Commit history list - fixed height with scroll */}
              <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-zinc-50 mb-4">Commit History</h3>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading commit history...</div>
                  </div>
                ) : historyError ? (
                  <div className="text-red-400 py-8 text-center">
                    <p className="font-semibold mb-2">Error loading commit history</p>
                    <p className="text-sm text-muted-foreground">{historyError.message}</p>
                  </div>
                ) : historyData?.commits && historyData.commits.length > 0 ? (
                  <ScrollArea className="h-[25vh]">
                    <CommitHistoryViewer
                      commits={historyData.commits}
                      onCommitSelect={setSelectedCommitSha}
                      selectedCommitSha={selectedCommitSha}
                    />
                  </ScrollArea>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <p>No commit history available</p>
                    <p className="text-sm mt-2 text-zinc-500">
                      This file may not have any commits yet, or the branch may not exist in the repository.
                    </p>
                  </div>
                )}
              </div>

              {/* Diff viewer - show when commit selected, scrollable */}
              {selectedCommitSha && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <h3 className="text-lg font-semibold text-zinc-50 mb-4 flex-shrink-0">
                    Changes in Commit {selectedCommitSha.substring(0, 7)}
                  </h3>
                  {diffLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted-foreground">Loading diff...</div>
                    </div>
                  ) : diffData ? (
                    <ScrollArea className="flex-1">
                      <DiffViewer diff={diffData} />
                    </ScrollArea>
                  ) : (
                    <div className="text-muted-foreground py-8 text-center">
                      No diff available for this commit
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
