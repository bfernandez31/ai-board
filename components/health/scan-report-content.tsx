'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ScanReportContentProps {
  report: string | null;
}

export function ScanReportContent({ report }: ScanReportContentProps) {
  if (!report) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        Report data unavailable
      </div>
    );
  }

  return (
    <div className="prose prose-invert max-w-none text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold mb-3 text-foreground" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-semibold mb-2 mt-4 text-foreground" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold mb-2 mt-3 text-foreground" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-sm text-muted-foreground mb-2 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-4 mb-2 text-sm text-muted-foreground" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-4 mb-2 text-sm text-muted-foreground" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="mb-1" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-ctp-blue hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-foreground" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block bg-muted p-3 rounded-md text-xs overflow-x-auto ${className ?? ''}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="bg-muted rounded-md overflow-x-auto mb-3" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm border-collapse" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground bg-muted" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-border px-3 py-1.5 text-xs text-muted-foreground" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-ctp-blue pl-3 italic text-muted-foreground mb-2" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="border-border my-3" {...props} />
          ),
        }}
      >
        {report}
      </ReactMarkdown>
    </div>
  );
}
