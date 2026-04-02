'use client';

import { useState } from 'react';
import { Settings2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ServiceConfig {
  type: string;
  version: string;
}

interface StoredConfig {
  version?: number;
  project?: { name?: string; language?: string; framework?: string };
  runtime?: { manager?: string; manager_version?: string };
  services?: ServiceConfig[];
  commands?: Record<string, string>;
  agent?: { cli?: string; model?: string };
}

interface ConfigCardProps {
  project: {
    id: number;
    config: StoredConfig | null;
    configSyncedAt: string | null;
  };
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConfigCard({ project }: ConfigCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [config, setConfig] = useState<StoredConfig | null>(project.config);
  const [syncedAt, setSyncedAt] = useState<string | null>(project.configSyncedAt);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/config/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sync failed');
      }

      const data = await response.json();
      setConfig(data.config);
      setSyncedAt(data.syncedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync config');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Project Configuration</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            data-testid="sync-config-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync config'}
          </Button>
        </div>
        <CardDescription>
          Configuration from <code className="text-xs">.ai-board/config.yml</code> in your repository
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!config ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No configuration synced yet.</p>
            <p className="text-sm mt-1">
              Click &quot;Sync config&quot; to fetch your project&apos;s configuration from GitHub.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Runtime */}
            {config.project && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Runtime</h4>
                <div className="flex flex-wrap gap-2">
                  {config.project.language && (
                    <Badge variant="secondary">{config.project.language}</Badge>
                  )}
                  {config.project.framework && config.project.framework !== 'none' && (
                    <Badge variant="secondary">{config.project.framework}</Badge>
                  )}
                  {config.runtime?.manager && (
                    <Badge variant="outline">
                      {config.runtime.manager}
                      {config.runtime.manager_version ? ` v${config.runtime.manager_version}` : ''}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Services */}
            {config.services && config.services.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Services</h4>
                <div className="flex flex-wrap gap-2">
                  {config.services.map((svc) => (
                    <Badge key={svc.type} variant="secondary">
                      {svc.type} {svc.version}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Agent */}
            {config.agent && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Agent</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{config.agent.cli}</Badge>
                  {config.agent.model && (
                    <Badge variant="outline">{config.agent.model}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Last synced */}
            {syncedAt && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Last synced: {formatTimestamp(syncedAt)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
