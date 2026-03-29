'use client';

import { Award } from 'lucide-react';
import { getScoreColor } from '@/lib/quality-score';
import type { HealthModuleStatus } from '@/lib/health/types';

interface QualityGateContentProps {
  module: HealthModuleStatus;
}

export function QualityGateContent({ module }: QualityGateContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Quality Gate Overview</h3>
      </div>

      {module.score !== null ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Current Score:</span>
            <span className={`text-lg font-bold ${getScoreColor(module.score).text}`}>
              {module.score}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Quality gate scores are derived from the latest verify job&apos;s code review dimensions:
            Compliance, Bug Detection, Code Comments, Historical Context, and Spec Sync.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No quality gate data available yet. Quality scores are computed during the VERIFY stage.
        </p>
      )}
    </div>
  );
}
