'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Pencil, History, FileText, Scroll } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useConstitution, useConstitutionMutation } from '@/lib/hooks/use-constitution';
import { useConstitutionHistory, useConstitutionDiff } from '@/lib/hooks/use-constitution-history';
import { CommitHistoryViewer } from '@/components/ticket/commit-history-viewer';
import { DiffViewer } from '@/components/ticket/diff-viewer';

interface ConstitutionViewerProps {
  /** Project ID */
  projectId: number;

  /** Project name for display in modal header */
  projectName: string;

  /** Whether the modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * ConstitutionViewer Component
 *
 * Modal viewer for project constitution with View, Edit, and History tabs.
 *
 * Features:
 * - View: Renders markdown with syntax highlighting
 * - Edit: Textarea-based editing with unsaved changes warnings
 * - History: Commit history with diff viewer
 * - Loading skeletons and error handling
 * - TanStack Query for caching and state management
 */
export default function ConstitutionViewer({
  projectId,
  projectName,
  open,
  onOpenChange,
}: ConstitutionViewerProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'history'>('view');
  const [editContent, setEditContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch constitution content
  const { data, isLoading, error } = useConstitution(projectId, open);
  const isNotFound = !!(error && (error as Error & { notFound?: boolean }).notFound);

  // Mutation for saving
  const mutation = useConstitutionMutation(projectId);

  // Fetch history when on history tab
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
  } = useConstitutionHistory(projectId, open && activeTab === 'history');

  // Fetch diff for selected commit
  const { data: diffData, isLoading: diffLoading } = useConstitutionDiff(
    projectId,
    selectedCommitSha
  );

  // Initialize edit content when data loads or tab changes to edit
  useEffect(() => {
    if (data?.content && activeTab === 'edit') {
      setEditContent(data.content);
      setIsDirty(false);
    }
  }, [data?.content, activeTab]);

  // Track dirty state
  useEffect(() => {
    if (data?.content && activeTab === 'edit') {
      setIsDirty(editContent !== data.content);
    }
  }, [editContent, data?.content, activeTab]);

  // Warn user about unsaved changes on browser navigation/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Show error toast when error occurs
  useEffect(() => {
    if (error && open && !isNotFound) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch constitution',
      });
    }
  }, [error, open, isNotFound, toast]);

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        if (isDirty) {
          const confirmed = window.confirm(
            'You have unsaved changes. Are you sure you want to close?'
          );
          if (!confirmed) return;
        }
        setActiveTab('view');
        setEditContent('');
        setIsDirty(false);
        setSelectedCommitSha(null);
      }
      onOpenChange(newOpen);
    },
    [isDirty, onOpenChange]
  );

  // Handle tab change with unsaved changes check
  const handleTabChange = useCallback(
    (value: string) => {
      if (isDirty && activeTab === 'edit' && value !== 'edit') {
        const confirmed = window.confirm(
          'You have unsaved changes. Are you sure you want to switch tabs?'
        );
        if (!confirmed) return;
        setIsDirty(false);
      }
      setActiveTab(value as 'view' | 'edit' | 'history');
      if (value !== 'history') {
        setSelectedCommitSha(null);
      }
    },
    [isDirty, activeTab]
  );

  // Handle save
  const handleSave = async () => {
    try {
      await mutation.mutateAsync({ content: editContent });
      toast({
        title: 'Success',
        description: 'Constitution saved successfully',
      });
      setIsDirty(false);
      setActiveTab('view');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save constitution';
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: errorMessage,
      });
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    setEditContent(data?.content || '');
    setIsDirty(false);
    setActiveTab('view');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-w-[90vw] bg-zinc-950">
        <DialogHeader className="pr-12">
          <DialogTitle className="text-zinc-50 flex items-center gap-2">
            <Scroll className="h-5 w-5" />
            Constitution - {projectName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="view" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View
            </TabsTrigger>
            <TabsTrigger
              value="edit"
              className="flex items-center gap-2"
              disabled={isNotFound}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2"
              disabled={isNotFound}
            >
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* View Tab */}
          <TabsContent value="view" className="mt-4">
            {isLoading && (
              <div className="space-y-4 p-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}

            {isNotFound && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <Scroll className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Constitution Found</p>
                <p className="text-sm text-zinc-500 text-center max-w-md">
                  This project doesn&apos;t have a constitution file yet.
                  Create one using the <code className="bg-zinc-800 px-1.5 py-0.5 rounded">/speckit.constitution</code> command in Claude Code.
                </p>
              </div>
            )}

            {error && !isNotFound && !isLoading && (
              <div className="text-red-400 py-4">
                <p>Error: {error.message}</p>
              </div>
            )}

            {data && !isLoading && (
              <ScrollArea className="h-[60vh] w-full rounded-md pr-4">
                <div className="prose prose-invert max-w-none bg-zinc-900 p-6 rounded-lg">
                  <ReactMarkdown
                    className="text-zinc-100"
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ ...props }) => (
                        <h1 className="text-3xl font-bold mb-4 text-zinc-50" {...props} />
                      ),
                      h2: ({ ...props }) => (
                        <h2 className="text-2xl font-semibold mb-3 mt-6 text-zinc-50" {...props} />
                      ),
                      h3: ({ ...props }) => (
                        <h3 className="text-xl font-semibold mb-2 mt-4 text-zinc-100" {...props} />
                      ),
                      h4: ({ ...props }) => (
                        <h4 className="text-lg font-semibold mb-2 mt-3 text-zinc-100" {...props} />
                      ),
                      h5: ({ ...props }) => (
                        <h5 className="text-base font-semibold mb-1 mt-2 text-zinc-200" {...props} />
                      ),
                      h6: ({ ...props }) => (
                        <h6 className="text-sm font-semibold mb-1 mt-2 text-zinc-200" {...props} />
                      ),
                      p: ({ ...props }) => (
                        <p className="mb-4 text-zinc-200 leading-relaxed" {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul className="list-disc ml-6 mb-4 text-zinc-200" {...props} />
                      ),
                      ol: ({ ...props }) => (
                        <ol className="list-decimal ml-6 mb-4 text-zinc-200" {...props} />
                      ),
                      li: ({ ...props }) => (
                        <li className="mb-1 text-zinc-200" {...props} />
                      ),
                      a: ({ ...props }) => (
                        <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
                      ),
                      blockquote: ({ ...props }) => (
                        <blockquote
                          className="border-l-4 border-zinc-600 pl-4 italic text-zinc-400 my-4"
                          {...props}
                        />
                      ),
                      code: ({ className, children, ...props }) => {
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
                      pre: ({ ...props }) => (
                        <pre className="bg-zinc-900 rounded-md p-4 overflow-x-auto my-4" {...props} />
                      ),
                      table: ({ ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border border-zinc-700" {...props} />
                        </div>
                      ),
                      thead: ({ ...props }) => (
                        <thead className="bg-zinc-800" {...props} />
                      ),
                      tbody: ({ ...props }) => (
                        <tbody {...props} />
                      ),
                      tr: ({ ...props }) => (
                        <tr className="border-b border-zinc-700" {...props} />
                      ),
                      th: ({ ...props }) => (
                        <th className="px-4 py-2 text-left text-zinc-50 font-semibold" {...props} />
                      ),
                      td: ({ ...props }) => (
                        <td className="px-4 py-2 text-zinc-200" {...props} />
                      ),
                      hr: ({ ...props }) => (
                        <hr className="border-zinc-700 my-6" {...props} />
                      ),
                    }}
                  >
                    {data.content}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="mt-4">
            <div className="flex flex-col h-[65vh] space-y-4">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 min-h-[400px] font-mono text-sm resize-none bg-zinc-900 border-zinc-700"
                placeholder="Enter constitution content..."
                disabled={mutation.isPending}
                data-testid="constitution-editor-textarea"
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || mutation.isPending}
                  data-testid="constitution-save-button"
                >
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>

              {mutation.isError && (
                <div className="text-sm text-red-600">
                  Error: {mutation.error instanceof Error ? mutation.error.message : 'Failed to save'}
                </div>
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <div className="h-[65vh] flex flex-col gap-6">
              {/* Commit history list */}
              <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-zinc-50 mb-4">Commit History</h3>
                {historyLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : historyError ? (
                  <div className="text-red-400 py-8 text-center">
                    <p className="font-semibold mb-2">Error loading commit history</p>
                    <p className="text-sm text-zinc-400">{historyError.message}</p>
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
                  <div className="text-zinc-400 py-8 text-center">
                    <p>No commit history available</p>
                    <p className="text-sm mt-2 text-zinc-500">
                      This file may not have any commits yet.
                    </p>
                  </div>
                )}
              </div>

              {/* Diff viewer */}
              {selectedCommitSha && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <h3 className="text-lg font-semibold text-zinc-50 mb-4 flex-shrink-0">
                    Changes in Commit {selectedCommitSha.substring(0, 7)}
                  </h3>
                  {diffLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : diffData ? (
                    <ScrollArea className="flex-1">
                      <DiffViewer diff={diffData} />
                    </ScrollArea>
                  ) : (
                    <div className="text-zinc-400 py-8 text-center">
                      No diff available for this commit
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
