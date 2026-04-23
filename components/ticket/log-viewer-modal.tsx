'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useJobLogs } from '@/lib/hooks/queries/useJobLogs';
import { format } from 'date-fns';
import { SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import type { LogRetrievalResponse } from '@/lib/types/log-types';

/**
 * Log Entry Component
 * Individual log entry display
 */
function LogEntry({ entry }: { entry: LogRetrievalResponse['logEntries'][number] }) {
  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'ERROR': return 'bg-red-500';
      case 'WARNING': return 'bg-yellow-500';
      case 'TOOL': return 'bg-blue-500';
      default: return 'bg-gray-500';
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
        <div className="flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </div>
          <div className="mt-0.5 text-sm">
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

/**
 * Log Header Component
 * Log metadata display
 */
function LogHeader({ logs }: { logs: LogRetrievalResponse }) {
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
      <div className="mt-2 flex gap-4 text-sm">
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
      </div>
    </div>
  );
}

/**
 * Log Viewer Modal Component
 * Detailed log display with syntax highlighting and filtering
 */
export function LogViewerModal({
  jobId,
  isOpen,
  onClose,
}: {
  jobId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState('entries');
  const [filterType, setFilterType] = useState<'all' | 'errors' | 'warnings' | 'tools'>('all');
  
  const { data: logs, isLoading, error } = useJobLogs(jobId, {
    enabled: isOpen && jobId > 0,
  });

  // Filter log entries based on selected type
  const filteredEntries = logs?.logEntries.filter(entry => {
    if (filterType === 'all') return true;
    if (filterType === 'errors') return entry.messageType === 'ERROR';
    if (filterType === 'warnings') return entry.messageType === 'WARNING';
    if (filterType === 'tools') return entry.messageType === 'TOOL';
    return true;
  }) || [];

  // Count entries by type
  const errorCount = logs?.logEntries.filter(e => e.messageType === 'ERROR').length || 0;
  const warningCount = logs?.logEntries.filter(e => e.messageType === 'WARNING').length || 0;
  const toolCount = logs?.logEntries.filter(e => e.messageType === 'TOOL').length || 0;

  useEffect(() => {
    if (!isOpen) {
      // Reset filter when modal closes
      setFilterType('all');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Job Execution Logs</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-600">
            Failed to load logs: {error.message}
          </div>
        ) : logs ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <LogHeader logs={logs} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="entries">Entries</TabsTrigger>
                  <TabsTrigger value="raw">Raw Content</TabsTrigger>
                </TabsList>
                
                <div className="ml-auto flex gap-2">
                  <Button 
                    variant={filterType === 'all' ? 'secondary' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilterType('all')}
                  >
                    All ({filteredEntries.length})
                  </Button>
                  <Button 
                    variant={filterType === 'errors' ? 'destructive' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilterType('errors')}
                  >
                    Errors ({errorCount})
                  </Button>
                  <Button 
                    variant={filterType === 'warnings' ? 'secondary' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilterType('warnings')}
                  >
                    Warnings ({warningCount})
                  </Button>
                  <Button 
                    variant={filterType === 'tools' ? 'secondary' : 'outline'} 
                    size="sm" 
                    onClick={() => setFilterType('tools')}
                  >
                    Tools ({toolCount})
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <TabsContent value="entries" className="h-full">
                  <div className="space-y-2">
                    {filteredEntries.length > 0 ? (
                      filteredEntries.map(entry => (
                        <LogEntry key={entry.id} entry={entry} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No log entries found
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="raw" className="h-full">
                  <div className="h-full">
                    {logs.fullLogUrl ? (
                      <div className="h-full">
                        <div className="mb-2 flex justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => window.open(logs.fullLogUrl, '_blank')}
                          >
                            Open Full Log
                          </Button>
                        </div>
                        <SyntaxHighlighter 
                          language="json" 
                          style={atomOneDark} 
                          customStyle={{ 
                            height: 'calc(100% - 40px)', 
                            overflow: 'auto',
                            background: 'transparent',
                          }}
                        >
                          {logs.preview}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Full log content not available
                      </div>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              {logs.fullLogUrl && (
                <Button 
                  onClick={() => window.open(logs.fullLogUrl, '_blank', 'noopener,noreferrer')}
                >
                  Download Full Log
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}