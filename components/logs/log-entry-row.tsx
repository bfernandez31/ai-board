'use client';

import { MessageSquare, Wrench, AlertCircle, ArrowRight, FileText } from 'lucide-react';
import type { LogEventType, NormalizedLogEntry } from '@/lib/logs/types';

const EVENT_TYPE_CONFIG: Record<LogEventType, { icon: typeof MessageSquare; colorClass: string }> = {
  message: { icon: MessageSquare, colorClass: 'text-blue-400' },
  tool_invocation: { icon: Wrench, colorClass: 'text-amber-400' },
  tool_result: { icon: FileText, colorClass: 'text-zinc-400' },
  error: { icon: AlertCircle, colorClass: 'text-red-500' },
  status_change: { icon: ArrowRight, colorClass: 'text-green-400' },
};

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

interface LogEntryRowProps {
  entry: NormalizedLogEntry;
}

export function LogEntryRow({ entry }: LogEntryRowProps) {
  const config = EVENT_TYPE_CONFIG[entry.eventType];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-muted/50">
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <Icon className={`w-3.5 h-3.5 ${config.colorClass}`} />
        <time className="text-xs text-muted-foreground font-mono w-[72px]" dateTime={entry.timestamp}>
          {formatTime(entry.timestamp)}
        </time>
      </div>
      <p className={`text-sm font-mono break-all ${entry.eventType === 'error' ? 'text-red-500' : 'text-foreground'}`}>
        {entry.content}
      </p>
    </div>
  );
}
