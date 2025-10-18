'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useDocumentation } from '@/lib/hooks/use-documentation';
import type { DocumentType } from '@/lib/validations/documentation';

/**
 * Human-readable labels for documentation types
 */
const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
};

interface DocumentationViewerProps {
  /** Ticket ID */
  ticketId: number;

  /** Project ID */
  projectId: number;

  /** Ticket title for display in modal header */
  ticketTitle: string;

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
  docType,
  open,
  onOpenChange,
}: DocumentationViewerProps) {
  const { toast } = useToast();

  // Fetch documentation using TanStack Query hook
  // Only fetches when modal is open (enabled=open)
  const { data, isLoading, error } = useDocumentation(
    projectId,
    ticketId,
    docType,
    open
  );

  // Show error toast when error occurs
  if (error && open) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: error.message || 'Failed to fetch documentation',
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-w-[90vw] bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {DocumentTypeLabels[docType]} - Ticket #{ticketId}: {ticketTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-zinc-400">
                Loading {docType}...
              </div>
            </div>
          )}

          {error && !data && (
            <div className="text-red-400 py-4">
              <p>Error: {error.message}</p>
            </div>
          )}

          {data && (
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
                  {data.content}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
