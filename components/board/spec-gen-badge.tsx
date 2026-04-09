'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useSpecGenPolling } from '@/app/lib/hooks/useSpecGenPolling';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SpecGenBadgeProps {
  projectId: number;
}

export function SpecGenBadge({ projectId }: SpecGenBadgeProps) {
  const { job, specsGeneratedAt } = useSpecGenPolling(projectId);
  const { toast } = useToast();
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isFading, setIsFading] = useState(false);

  const isActive = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const isCompleted = job?.status === 'COMPLETED' || !!specsGeneratedAt;
  const isFailed = job?.status === 'FAILED';

  // Fade out completed badge after 30s
  useEffect(() => {
    if (!isCompleted || !showCompleted) return;
    const fadeTimer = setTimeout(() => setIsFading(true), 27000);
    const removeTimer = setTimeout(() => setShowCompleted(false), 30000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isCompleted, showCompleted]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/spec-generation/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: job?.agent ?? 'CLAUDE',
          depth: job?.depth ?? 'STANDARD',
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        toast({
          title: 'Retry failed',
          description: data.error || 'Could not restart spec generation.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Retry failed',
        description: 'Could not connect to the server.',
        variant: 'destructive',
      });
    } finally {
      setIsRetrying(false);
    }
  }, [projectId, job?.agent, job?.depth, toast]);

  if (!isActive && !isCompleted && !isFailed) return null;
  if (isCompleted && !showCompleted) return null;

  function getBadgeColorClasses(): string {
    if (isActive) return 'bg-ctp-sapphire/10 text-ctp-sapphire border border-ctp-sapphire/20';
    if (isCompleted) return 'bg-ctp-green/10 text-ctp-green border border-ctp-green/20';
    return 'bg-ctp-red/10 text-ctp-red border border-ctp-red/20';
  }

  return (
    <div
      data-testid="spec-gen-badge"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-opacity duration-3000 ${getBadgeColorClasses()} ${isFading ? 'opacity-0' : 'opacity-100'}`}
    >
      {isActive && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Generating specs...</span>
        </>
      )}
      {isCompleted && showCompleted && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Specs ready</span>
        </>
      )}
      {isFailed && (
        <>
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Spec generation failed</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </>
      )}
    </div>
  );
}
