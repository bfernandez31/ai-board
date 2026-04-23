'use client';

import { format } from 'date-fns';
import type { LogRetrievalResponse } from '@/lib/types/log-types';

/**
 * Log Header Component
 * Log metadata display for use in various contexts
 */
export function LogHeader({ logs }: { logs: LogRetrievalResponse }) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Agent Execution Logs</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Job ID: {logs.jobId} • {logs.agentType}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(logs.timestamp), 'PPpp')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Expires: {format(new Date(logs.expirationDate), 'PP')}
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-sm flex-wrap">
        <div>
          <span className="font-medium">Status:</span> 
          <span className={`capitalize ${logs.status === 'COMPLETED' ? 'text-green-600' : 'text-red-600'}`}>
            {logs.status.toLowerCase()}
          </span>
        </div>
        <div>
          <span className="font-medium">Size:</span> 
          <span>{(logs.contentSize / 1024).toFixed(1)} KB</span>
        </div>
        <div>
          <span className="font-medium">Entries:</span> 
          <span>{logs.logEntries.length}</span>
        </div>
      </div>
    </div>
  );
}