'use client';

import { Badge } from '@/components/ui/badge';
import type { LogRetrievalResponse } from '@/lib/types/log-types';

/**
 * Log Entry Component
 * Individual log entry display for use in various contexts
 */
export function LogEntry({ entry }: { entry: LogRetrievalResponse['logEntries'][number] }) {
  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'ERROR': return 'bg-red-500 hover:bg-red-600';
      case 'WARNING': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'TOOL': return 'bg-blue-500 hover:bg-blue-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getMessageTypeText = (type: string) => {
    switch (type) {
      case 'ERROR': return 'Error';
      case 'WARNING': return 'Warning';
      case 'TOOL': return 'Tool';
      default: return 'Info';
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 py-2">
      <div className="flex items-start gap-2">
        <Badge className={getMessageTypeColor(entry.messageType)}>
          {getMessageTypeText(entry.messageType)}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </div>
          <div className="mt-0.5 text-sm break-words">
            {entry.content}
          </div>
          {entry.toolName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tool: {entry.toolName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}