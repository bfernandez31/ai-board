'use client';

import { Clock, GitCommit, User } from 'lucide-react';
import type { DocumentationHistoryResponse } from '@/app/lib/schemas/documentation';

interface CommitHistoryViewerProps {
  /** Commit history data from API */
  commits: DocumentationHistoryResponse['commits'];

  /** Callback when a commit is selected to view diff */
  onCommitSelect?: (sha: string) => void;

  /** Currently selected commit SHA */
  selectedCommitSha?: string | null;
}

/**
 * CommitHistoryViewer Component
 *
 * Displays a list of commits for a documentation file with:
 * - Author name and email
 * - Commit message
 * - Timestamp (formatted)
 * - Clickable to view diff
 *
 * Features:
 * - Scrollable list for long history
 * - Visual feedback for selected commit
 * - Formatted timestamps (relative or absolute)
 * - Author attribution with icons
 */
export function CommitHistoryViewer({
  commits,
  onCommitSelect,
  selectedCommitSha,
}: CommitHistoryViewerProps) {
  if (commits.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-zinc-400"
        data-testid="commit-history-empty"
      >
        <GitCommit className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No commits found for this document</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="commit-history-list">
      {commits.map((commit) => {
          const isSelected = selectedCommitSha === commit.sha;
          const date = new Date(commit.author.date);
          const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <button
              key={commit.sha}
              onClick={() => onCommitSelect?.(commit.sha)}
              className={`
                w-full text-left p-4 rounded-lg border transition-colors
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'
                }
              `}
              data-testid="commit-item"
            >
              {/* Commit header */}
              <div className="flex items-start gap-3 mb-2">
                <GitCommit className="h-4 w-4 mt-1 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-50 line-clamp-2">
                    {commit.message.split('\n')[0]}
                  </p>
                </div>
              </div>

              {/* Author and timestamp */}
              <div className="flex items-center gap-4 ml-7 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  <span>{commit.author.name}</span>
                  <span className="text-zinc-600">({commit.author.email})</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>{formattedDate}</span>
                </div>
              </div>

              {/* Short SHA */}
              <div className="ml-7 mt-2">
                <code className="text-xs text-zinc-500 font-mono">
                  {commit.sha.substring(0, 7)}
                </code>
              </div>
            </button>
          );
        })}
    </div>
  );
}
