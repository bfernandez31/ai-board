'use client';

import {
  MessageSquare,
  Wrench,
  CheckCheck,
  XCircle,
  Clock,
  Copy,
  CircleHelp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/app/lib/hooks/useCopyToClipboard';
import type { NormalizedEvent } from '@/app/lib/logs/schema';

interface EventVisual {
  icon: typeof MessageSquare;
  tone: string;
  label: string;
}

const EVENT_ICON: Record<NormalizedEvent['type'], EventVisual> = {
  message: { icon: MessageSquare, tone: 'text-ctp-blue', label: 'Message' },
  tool_invocation: { icon: Wrench, tone: 'text-ctp-mauve', label: 'Tool Invocation' },
  tool_result: { icon: CheckCheck, tone: 'text-ctp-green', label: 'Tool Result' },
  error: { icon: XCircle, tone: 'text-ctp-red', label: 'Error' },
  lifecycle: { icon: Clock, tone: 'text-ctp-overlay0', label: 'Lifecycle' },
};

const UNKNOWN_ICON: EventVisual = { icon: CircleHelp, tone: 'text-ctp-overlay0', label: 'Unknown' };

function renderBody(event: NormalizedEvent): string {
  switch (event.type) {
    case 'message':
      return event.payload.text || event.payload.thinking || '';
    case 'tool_invocation':
      return `${event.payload.toolName}(${JSON.stringify(event.payload.input ?? null)})`;
    case 'tool_result':
      return `${event.payload.isError ? '[error] ' : ''}${JSON.stringify(event.payload.output ?? null)}`;
    case 'error':
      return event.payload.stack
        ? `${event.payload.message}\n${event.payload.stack}`
        : event.payload.message;
    case 'lifecycle':
      return event.payload.detail
        ? `${event.payload.kind}: ${event.payload.detail}`
        : event.payload.kind;
    default: {
      const unknown = event as unknown as { type: string };
      return `Unknown event type: ${unknown.type}`;
    }
  }
}

interface LogEventRowProps {
  event: NormalizedEvent;
}

export function LogEventRow({ event }: LogEventRowProps) {
  const { copy, isCopied } = useCopyToClipboard();
  const visual = EVENT_ICON[event.type] ?? UNKNOWN_ICON;
  const Icon = visual.icon;
  const isToolResultError = event.type === 'tool_result' && event.payload.isError;
  const iconTone = isToolResultError ? 'text-ctp-red' : visual.tone;
  const body = renderBody(event);
  const copyPayload = JSON.stringify(event, null, 2);

  const timestamp = (() => {
    try {
      return new Date(event.ts).toLocaleTimeString();
    } catch {
      return event.ts;
    }
  })();

  return (
    <div
      className="flex items-start gap-2 border border-ctp-mauve/15 rounded-md p-3"
      data-testid={`log-event-row-${event.type}`}
    >
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconTone}`} aria-label={visual.label} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{visual.label}</span>
            <span aria-hidden>·</span>
            <span>{timestamp}</span>
            <span aria-hidden>·</span>
            <span>{event.agent}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(copyPayload)}
            aria-label={isCopied ? 'Copied!' : 'Copy event'}
            className="h-7 px-2 text-xs"
            data-testid={`log-event-copy-${event.type}`}
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            {isCopied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">{body}</pre>
      </div>
    </div>
  );
}
