'use client';

interface LogPreviewProps {
  logStatus: string;
  logSummary: string | null;
  jobStatus: string;
}

export function LogPreview({ logStatus, logSummary, jobStatus }: LogPreviewProps) {
  if (logStatus === 'NONE') {
    return null;
  }

  if (logStatus === 'PRUNED') {
    return (
      <p className="text-xs text-subtext0 mt-1 italic">Logs expired</p>
    );
  }

  if (!logSummary) {
    return null;
  }

  const colorClass = jobStatus === 'FAILED' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <p className={`text-xs ${colorClass} mt-1 line-clamp-2`}>
      {logSummary}
    </p>
  );
}
