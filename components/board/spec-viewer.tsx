'use client';

import { useEffect, useState } from 'react';
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

interface SpecViewerProps {
  /** Ticket ID */
  ticketId: number;

  /** Project ID */
  projectId: number;

  /** Ticket title for display in modal header */
  ticketTitle: string;

  /** Whether the modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * SpecViewer Component
 *
 * Displays the specification document (spec.md) for a ticket in a modal dialog.
 * Features:
 * - Fetches spec content from API
 * - Renders markdown with syntax highlighting
 * - Loading and error states
 * - Scrollable content for large specs
 * - Responsive design for mobile
 */
export default function SpecViewer({
  ticketId,
  projectId,
  ticketTitle,
  open,
  onOpenChange,
}: SpecViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      setContent(null);
      setError(null);
      return;
    }

    const fetchSpec = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/projects/${projectId}/tickets/${ticketId}/spec`
        );

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch specification');
        }

        const data = await res.json();
        setContent(data.content);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpec();
  }, [open, projectId, ticketId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>
            Specification - Ticket #{ticketId}: {ticketTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-zinc-400">Loading specification...</div>
            </div>
          )}

          {error && !content && (
            <div className="text-red-400 py-4">
              <p>Error: {error}</p>
            </div>
          )}

          {content && (
            <ScrollArea className="h-[60vh] w-full rounded-md pr-4">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown
                  className="text-zinc-100"
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1
                        className="text-3xl font-bold mb-4 text-zinc-100"
                        {...props}
                      />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2
                        className="text-2xl font-semibold mb-3 mt-6 text-zinc-200"
                        {...props}
                      />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3
                        className="text-xl font-semibold mb-2 mt-4 text-zinc-200"
                        {...props}
                      />
                    ),
                    h4: ({ node, ...props }) => (
                      <h4
                        className="text-lg font-semibold mb-2 mt-3 text-zinc-300"
                        {...props}
                      />
                    ),
                    h5: ({ node, ...props }) => (
                      <h5
                        className="text-base font-semibold mb-1 mt-2 text-zinc-300"
                        {...props}
                      />
                    ),
                    h6: ({ node, ...props }) => (
                      <h6
                        className="text-sm font-semibold mb-1 mt-2 text-zinc-400"
                        {...props}
                      />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="mb-4 text-zinc-300 leading-relaxed" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc ml-6 mb-4 text-zinc-300" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal ml-6 mb-4 text-zinc-300" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="mb-1 text-zinc-300" {...props} />
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
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
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
                      <th className="px-4 py-2 text-left text-zinc-200 font-semibold" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-4 py-2 text-zinc-300" {...props} />
                    ),
                    hr: ({ node, ...props }) => (
                      <hr className="border-zinc-700 my-6" {...props} />
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
