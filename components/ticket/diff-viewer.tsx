'use client';

import { FileCode, Plus, Minus } from 'lucide-react';
import type { DocumentationDiffResponse } from '@/app/lib/schemas/documentation';

interface DiffViewerProps {
  /** Diff data from API */
  diff: DocumentationDiffResponse;
}

/**
 * DiffViewer Component
 *
 * Displays file diffs from a commit with:
 * - Filename and change statistics
 * - Added/removed/modified indicators
 * - Syntax-highlighted diff patch
 * - Line-by-line additions and deletions
 *
 * Features:
 * - Scrollable for large diffs
 * - Color-coded additions (green) and deletions (red)
 * - Context lines shown in default color
 * - File metadata (additions/deletions count)
 */
export function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff.files || diff.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <FileCode className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No changes in this commit</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="diff-viewer">
      {diff.files.map((file, index) => (
          <div key={index} className="border border-zinc-700 rounded-lg overflow-hidden">
            {/* File header */}
            <div className="bg-zinc-800 px-4 py-3 border-b border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-mono text-zinc-50">{file.filename}</span>
                </div>

                {/* Change statistics */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-green-400">
                    <Plus className="h-3 w-3" />
                    <span data-testid="additions-count">+{file.additions}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <Minus className="h-3 w-3" />
                    <span data-testid="deletions-count">-{file.deletions}</span>
                  </div>
                  <span className="text-zinc-500">
                    {file.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Diff patch */}
            {file.patch ? (
              <div className="bg-zinc-900">
                <pre className="text-xs font-mono p-4 overflow-x-auto">
                  {file.patch.split('\n').map((line, lineIndex) => {
                    let lineClass = 'text-zinc-300'; // Context lines
                    let dataTestId = '';

                    if (line.startsWith('+') && !line.startsWith('+++')) {
                      lineClass = 'text-green-400 bg-green-500/10 diff-addition';
                      dataTestId = 'diff-addition';
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                      lineClass = 'text-red-400 bg-red-500/10';
                      dataTestId = 'diff-deletion';
                    } else if (line.startsWith('@@')) {
                      lineClass = 'text-blue-400 font-semibold';
                    } else if (line.startsWith('+++') || line.startsWith('---')) {
                      lineClass = 'text-zinc-500';
                    }

                    return (
                      <div
                        key={lineIndex}
                        className={`${lineClass} px-2 -mx-2`}
                        data-testid={dataTestId}
                      >
                        {line}
                      </div>
                    );
                  })}
                </pre>
              </div>
            ) : (
              <div className="p-4 text-sm text-zinc-500 text-center">
                <p>Binary file or no diff available</p>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
