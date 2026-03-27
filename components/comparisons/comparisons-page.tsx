'use client';

import { useState, useEffect, useRef } from 'react';
import { GitCompare } from 'lucide-react';
import {
  useProjectComparisons,
  useProjectComparisonDetail,
  type ProjectComparisonSummary,
} from '@/hooks/use-project-comparisons';
import { ComparisonListItem } from './comparison-list-item';
import { ComparisonInlineDetail } from './comparison-inline-detail';
import { NewComparisonLauncher } from './new-comparison-launcher';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ComparisonsPageProps {
  projectId: number;
}

export function ComparisonsPage({ projectId }: ComparisonsPageProps) {
  const [offset, setOffset] = useState(0);
  const [allComparisons, setAllComparisons] = useState<ProjectComparisonSummary[]>([]);
  const [selectedComparisonId, setSelectedComparisonId] = useState<number | null>(null);
  const seenIds = useRef(new Set<number>());

  const limit = 20;
  const { data, isLoading, error } = useProjectComparisons(projectId, limit, offset);

  const { data: detailData, isLoading: isDetailLoading } = useProjectComparisonDetail(
    projectId,
    selectedComparisonId
  );

  useEffect(() => {
    if (!data) return;
    const newItems = data.comparisons.filter((c) => !seenIds.current.has(c.id));
    if (newItems.length > 0) {
      for (const item of newItems) seenIds.current.add(item.id);
      setAllComparisons((prev) => [...prev, ...newItems]);
    }
  }, [data]);

  const displayComparisons = allComparisons.length > 0 ? allComparisons : (data?.comparisons ?? []);

  const hasMore = data ? offset + limit < data.total : false;

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const handleSelectComparison = (comparisonId: number) => {
    setSelectedComparisonId((prev) => (prev === comparisonId ? null : comparisonId));
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Comparisons</h1>
            <p className="text-muted-foreground mt-2">Compare ticket implementations</p>
          </div>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive">Failed to load comparisons. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comparisons</h1>
          <p className="text-muted-foreground mt-2">Compare ticket implementations</p>
        </div>
        <NewComparisonLauncher projectId={projectId} />
      </div>

      {isLoading && displayComparisons.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : displayComparisons.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <GitCompare className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No comparisons yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Comparisons are generated when you compare ticket implementations in the VERIFY stage.
            Use the &quot;New Comparison&quot; button to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayComparisons.map((comparison) => (
            <div key={comparison.id}>
              <ComparisonListItem
                comparison={comparison}
                isSelected={selectedComparisonId === comparison.id}
                onClick={() => handleSelectComparison(comparison.id)}
              />
              {selectedComparisonId === comparison.id && (
                <ComparisonInlineDetail
                  detail={detailData ?? null}
                  isLoading={isDetailLoading}
                  onCollapse={() => setSelectedComparisonId(null)}
                />
              )}
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
