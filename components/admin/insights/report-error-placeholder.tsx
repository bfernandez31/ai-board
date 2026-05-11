import { Card, CardContent } from '@/components/ui/card';

/**
 * AIB-791 FR-024 placeholder for non-COMPLETED entries (RUNNING, FAILED, or
 * COMPLETED-but-blob-missing). Stable text so operators recognize the state
 * instantly.
 */
export function ReportErrorPlaceholder({
  title = 'Report content is no longer available',
  detail,
}: {
  title?: string;
  detail?: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        {detail ? <p className="mt-2">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
