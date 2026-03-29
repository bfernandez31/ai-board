'use client';

import { Sparkles } from 'lucide-react';
import type { HealthModuleStatus } from '@/lib/health/types';

interface LastCleanContentProps {
  module: HealthModuleStatus;
}

export function LastCleanContent({ module }: LastCleanContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Last Clean Overview</h3>
      </div>

      {module.lastCleanDate ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Last Cleanup:</span>
            <span className="text-sm text-foreground font-medium">
              {new Date(module.lastCleanDate).toLocaleDateString()}
            </span>
          </div>
          {module.label && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status:</span>
              <span className="text-sm text-ctp-green font-medium">{module.label}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Cleanup scans automatically identify and fix technical debt. Results are tracked as CLEAN workflow tickets.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No cleanup has been run yet. Cleanup is triggered automatically based on health scan findings.
        </p>
      )}
    </div>
  );
}
