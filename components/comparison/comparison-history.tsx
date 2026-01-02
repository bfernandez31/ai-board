'use client';

/**
 * Comparison History Component
 *
 * Displays a list of historical comparison reports for a ticket.
 * Allows users to select and view previous comparisons.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Clock, ChevronRight } from 'lucide-react';
import type { ComparisonSummary } from '@/lib/types/comparison';

interface ComparisonHistoryProps {
  comparisons: ComparisonSummary[];
  selectedFilename?: string;
  onSelect: (filename: string) => void;
  isLoading?: boolean;
}

export function ComparisonHistory({
  comparisons,
  selectedFilename,
  onSelect,
  isLoading = false,
}: ComparisonHistoryProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Comparison History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (comparisons.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Comparison History
          </CardTitle>
          <CardDescription>
            No comparisons have been generated yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">@ai-board /compare</code>{' '}
            in a comment to generate comparisons.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Comparison History
        </CardTitle>
        <CardDescription>
          {comparisons.length} comparison{comparisons.length !== 1 ? 's' : ''}{' '}
          available
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-2">
            {comparisons.map((comparison, index) => (
              <Button
                key={comparison.filename}
                variant={
                  selectedFilename === comparison.filename
                    ? 'secondary'
                    : 'ghost'
                }
                className="w-full justify-start h-auto py-3 px-3"
                onClick={() => onSelect(comparison.filename)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-start gap-3 w-full">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        vs {comparison.comparedTickets.join(', ')}
                      </span>
                      <Badge
                        variant={
                          comparison.isAligned ? 'default' : 'secondary'
                        }
                        className="shrink-0 text-xs"
                      >
                        {comparison.alignmentScore}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(comparison.generatedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  {(selectedFilename === comparison.filename ||
                    hoveredIndex === index) && (
                    <ChevronRight className="h-4 w-4 shrink-0 self-center" />
                  )}
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for inline display
 */
export function ComparisonHistoryCompact({
  comparisons,
  selectedFilename,
  onSelect,
}: Omit<ComparisonHistoryProps, 'isLoading'>) {
  if (comparisons.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">History:</span>
      <div className="flex flex-wrap gap-1">
        {comparisons.slice(0, 5).map((comparison) => (
          <Button
            key={comparison.filename}
            variant={
              selectedFilename === comparison.filename ? 'default' : 'outline'
            }
            size="sm"
            className="h-6 text-xs"
            onClick={() => onSelect(comparison.filename)}
          >
            {comparison.comparedTickets.join(', ')} ({comparison.alignmentScore}
            %)
          </Button>
        ))}
        {comparisons.length > 5 && (
          <span className="text-xs text-muted-foreground self-center">
            +{comparisons.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}
