export type LogEventType =
  | 'message'
  | 'tool_invocation'
  | 'tool_result'
  | 'error'
  | 'status_change';

export interface NormalizedLogEntry {
  timestamp: string;
  eventType: LogEventType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface LogUploadPayload {
  agentType: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';
  rawOutput: string;
}

export interface JobLogResponse {
  jobId: number;
  agentType: string;
  entries: NormalizedLogEntry[];
  entryCount: number;
  rawSize: number;
  truncated: boolean;
  createdAt: string;
}
