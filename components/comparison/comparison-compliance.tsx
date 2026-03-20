'use client';

import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ComparisonEntryData } from './types';

interface ComparisonComplianceProps {
  entries: ComparisonEntryData[];
}

export function ComparisonCompliance({ entries }: ComparisonComplianceProps) {
  const { principleNames, ticketKeys, lookupMap } = useMemo(() => {
    const names = new Set<string>();
    const keys: string[] = [];
    const map = new Map<string, Map<string, { passed: boolean; notes?: string }>>();

    for (const entry of entries) {
      const key = entry.ticket?.ticketKey ?? `Entry #${entry.rank}`;
      keys.push(key);
      const entryMap = new Map<string, { passed: boolean; notes?: string }>();
      for (const item of entry.complianceData) {
        names.add(item.name);
        const value: { passed: boolean; notes?: string } = { passed: item.passed };
        if (item.notes !== undefined) value.notes = item.notes;
        entryMap.set(item.name, value);
      }
      map.set(key, entryMap);
    }

    return {
      principleNames: Array.from(names).sort(),
      ticketKeys: keys,
      lookupMap: map,
    };
  }, [entries]);

  if (entries.length === 0 || principleNames.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No compliance data available.</p>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                Principle
              </th>
              {ticketKeys.map((key) => (
                <th
                  key={key}
                  className="text-center py-2 px-3 text-muted-foreground font-medium"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {principleNames.map((name) => (
              <tr key={name} className="border-b last:border-b-0">
                <td className="py-2 px-3 text-foreground">{name}</td>
                {ticketKeys.map((ticketKey) => {
                  const data = lookupMap.get(ticketKey)?.get(name);
                  if (!data) {
                    return (
                      <td
                        key={ticketKey}
                        className="text-center py-2 px-3 text-muted-foreground"
                      >
                        --
                      </td>
                    );
                  }
                  const icon = data.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 inline-block" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 inline-block" />
                  );

                  if (data.notes) {
                    return (
                      <td key={ticketKey} className="text-center py-2 px-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help inline-flex flex-col items-center gap-0.5">
                              {icon}
                              <span className="text-xs text-muted-foreground max-w-[120px] truncate block">
                                {data.notes}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{data.notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  }

                  return (
                    <td key={ticketKey} className="text-center py-2 px-3">
                      {icon}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
