import type { NormalizedLogEntry } from './types';

const MAX_SUMMARY_LENGTH = 2000;

function truncateTo(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function summarizeFailed(entries: NormalizedLogEntry[]): string {
  const errorEntries = entries.filter((e) => e.eventType === 'error');

  if (errorEntries.length > 0) {
    const lastError = errorEntries.at(-1)!;
    const prefix = errorEntries.length > 1
      ? `${errorEntries.length} errors found. Last error: `
      : 'Error: ';
    return truncateTo(prefix + lastError.content, MAX_SUMMARY_LENGTH);
  }

  if (entries.length > 0) {
    const lastEntry = entries.at(-1)!;
    return truncateTo(`Failed after ${entries.length} entries. Last output: ${lastEntry.content}`, MAX_SUMMARY_LENGTH);
  }

  return 'Job failed with no captured output.';
}

function summarizeCompleted(entries: NormalizedLogEntry[]): string {
  const toolInvocations = entries.filter((e) => e.eventType === 'tool_invocation');
  const lastEntry = entries.at(-1)!;

  const parts: string[] = [];

  if (toolInvocations.length > 0) {
    parts.push(`${toolInvocations.length} tool invocation${toolInvocations.length === 1 ? '' : 's'}`);
  }

  parts.push(`${entries.length} total entries`);
  parts.push(lastEntry.content);

  return truncateTo(`Completed: ${parts.join('. ')}`, MAX_SUMMARY_LENGTH);
}

function summarizeCancelled(entries: NormalizedLogEntry[]): string {
  const lastEntry = entries.at(-1)!;
  const base = `Cancelled after ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;
  return truncateTo(`${base}. Last: ${lastEntry.content}`, MAX_SUMMARY_LENGTH);
}

export function generateLogSummary(entries: NormalizedLogEntry[], jobStatus: string): string {
  if (entries.length === 0) {
    return `No log entries captured (status: ${jobStatus}).`;
  }

  switch (jobStatus) {
    case 'FAILED':
      return summarizeFailed(entries);
    case 'COMPLETED':
      return summarizeCompleted(entries);
    case 'CANCELLED':
      return summarizeCancelled(entries);
    default:
      return truncateTo(`${entries.length} log entries (status: ${jobStatus}).`, MAX_SUMMARY_LENGTH);
  }
}
