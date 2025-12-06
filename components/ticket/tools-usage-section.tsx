'use client';

import { Badge } from '@/components/ui/badge';
import type { ToolUsageCount } from '@/lib/types/job-types';

interface ToolsUsageSectionProps {
  toolUsage: ToolUsageCount[];
}

export function ToolsUsageSection({ toolUsage }: ToolsUsageSectionProps) {
  if (toolUsage.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm text-[#a6adc8] uppercase tracking-wider font-bold">
        Tools Used
      </h3>
      <div className="flex flex-wrap gap-2">
        {toolUsage.map(({ tool, count }) => (
          <Badge
            key={tool}
            variant="secondary"
            className="bg-[#313244] text-[#cdd6f4] border-[#45475a] hover:bg-[#45475a] transition-colors"
          >
            {tool}
            <span className="ml-1.5 text-[#89b4fa] font-semibold">{count}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
