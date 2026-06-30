'use client';

import { useState } from 'react';
import { FileCode, Plus, Minus, ChevronDown, ChevronRight, MessageSquare, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FileChange, InlineComment } from '@/app/lib/schemas/pr-diff';

interface PrFileDiffProps {
  file: FileChange;
  /** Whether the file block starts expanded (default true). */
  defaultOpen?: boolean;
}

const SOURCE_LABELS: Record<InlineComment['source'], string> = {
  'ai-board': 'AI-Board',
  bot: 'Bot',
  human: 'Human',
};

/** Fixed-contrast badge colors per comment source (theme-independent). */
const SOURCE_BADGE_CLASS: Record<InlineComment['source'], string> = {
  'ai-board': 'bg-ctp-mauve/15 text-ctp-mauve',
  bot: 'bg-ctp-sapphire/15 text-ctp-sapphire',
  human: 'bg-ctp-green/15 text-ctp-green',
};

interface PatchLine {
  text: string;
  className: string;
  testId: string;
  newLineNo: number | null;
}

/**
 * Walk a unified-diff patch, classifying each line for rendering and tracking the
 * new-file line number (used to anchor inline comments).
 */
function parsePatchLines(patch: string): PatchLine[] {
  const result: PatchLine[] = [];
  let newLine = 0;
  for (const line of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = parseInt(hunk[1]!, 10);
      result.push({ text: line, className: 'text-blue-400 font-semibold', testId: '', newLineNo: null });
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({
        text: line,
        className: 'text-green-400 bg-green-500/10 diff-addition',
        testId: 'diff-addition',
        newLineNo: newLine,
      });
      newLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({ text: line, className: 'text-red-400 bg-red-500/10', testId: 'diff-deletion', newLineNo: null });
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      result.push({ text: line, className: 'text-zinc-500', testId: '', newLineNo: null });
    } else if (line.startsWith('\\')) {
      result.push({ text: line, className: 'text-zinc-500', testId: '', newLineNo: null });
    } else {
      result.push({ text: line, className: 'text-zinc-300', testId: '', newLineNo: newLine || null });
      if (newLine) newLine++;
    }
  }
  return result;
}

function CommentRow({ comment }: { comment: InlineComment }) {
  return (
    <div
      className="bg-zinc-800/60 border-l-2 border-ctp-mauve/40 px-4 py-2 my-1 text-xs"
      data-testid="pr-inline-comment"
    >
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium text-zinc-200">{comment.author}</span>
        <Badge className={`px-1.5 py-0 text-[10px] ${SOURCE_BADGE_CLASS[comment.source]}`}>
          {SOURCE_LABELS[comment.source]}
        </Badge>
        {comment.outdated && (
          <span className="flex items-center gap-1 text-ctp-yellow" data-testid="comment-outdated">
            <AlertTriangle className="h-3 w-3" />
            outdated
          </span>
        )}
      </div>
      <p className="text-zinc-300 whitespace-pre-wrap break-words">{comment.body}</p>
    </div>
  );
}

/**
 * File body: binary/oversized/empty placeholders, or the rendered patch with
 * inline comments anchored to their new-file line number.
 */
function FileBody({ file }: { file: FileChange }) {
  if (file.binary) {
    return (
      <div className="p-4 text-sm text-zinc-500 text-center">
        <p>Binary file — no line content to display</p>
      </div>
    );
  }
  if (file.patchTruncated) {
    return (
      <div className="p-4 text-sm text-ctp-yellow text-center" data-testid="patch-truncated">
        <p>Diff too large to display — view it on GitHub</p>
      </div>
    );
  }
  if (!file.patch) {
    return (
      <div className="p-4 text-sm text-zinc-500 text-center">
        <p>No diff available</p>
      </div>
    );
  }

  const patchLines = parsePatchLines(file.patch);
  const anchoredByLine = new Map<number, InlineComment[]>();
  for (const comment of file.comments) {
    if (comment.outdated || comment.line == null) continue;
    const list = anchoredByLine.get(comment.line) ?? [];
    list.push(comment);
    anchoredByLine.set(comment.line, list);
  }

  return (
    <div className="bg-zinc-900">
      <pre className="text-xs font-mono p-4 whitespace-pre-wrap break-words">
        {patchLines.map((line, index) => {
          const comments = line.newLineNo != null ? anchoredByLine.get(line.newLineNo) : undefined;
          return (
            <div key={index}>
              <div className={`${line.className} px-2 -mx-2`} data-testid={line.testId || undefined}>
                {line.text}
              </div>
              {comments?.map((comment) => (
                <CommentRow key={comment.id} comment={comment} />
              ))}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

/**
 * PrFileDiff — renders a single PR file change in the existing `DiffViewer` visual
 * style (zinc card, green/red lines, +/- counters), collapsible, with read-only
 * inline comments anchored to their line and outdated comments surfaced at the
 * file header. No compose/reply/resolve controls (read-only, FR-011).
 */
export function PrFileDiff({ file, defaultOpen = true }: PrFileDiffProps) {
  const [open, setOpen] = useState(defaultOpen);

  const outdatedComments = file.comments.filter((c) => c.outdated);

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden" data-testid="pr-file-diff">
      {/* File header — toggles collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center justify-between gap-2 text-left hover:bg-zinc-750"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-mono text-zinc-50 truncate">{file.filename}</span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          {file.comments.length > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {file.comments.length}
            </span>
          )}
          <div className="flex items-center gap-1 text-green-400">
            <Plus className="h-3 w-3" />
            <span data-testid="additions-count">+{file.additions}</span>
          </div>
          <div className="flex items-center gap-1 text-red-400">
            <Minus className="h-3 w-3" />
            <span data-testid="deletions-count">-{file.deletions}</span>
          </div>
          <span className="text-zinc-500">{file.status}</span>
        </div>
      </button>

      {/* Outdated comments surfaced at the file header (anchor no longer exists). */}
      {outdatedComments.length > 0 && (
        <div className="bg-zinc-900 border-b border-zinc-700 px-2 py-2" data-testid="outdated-comments">
          <p className="text-[11px] uppercase tracking-wide text-ctp-yellow px-2 mb-1">
            Outdated comments
          </p>
          {outdatedComments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {open && <FileBody file={file} />}
    </div>
  );
}
