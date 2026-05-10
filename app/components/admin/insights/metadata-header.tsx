import { Card, CardContent } from '@/components/ui/card';

export interface MetadataHeaderProps {
  sessionsCount: number;
  ticketsCount: number;
  periodStart: string;
  periodEnd: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export function MetadataHeader({
  sessionsCount,
  ticketsCount,
  periodStart,
  periodEnd,
}: MetadataHeaderProps): JSX.Element {
  return (
    <Card className="aurora-card-bg aurora-glow">
      <CardContent className="pt-6">
        <p className="text-sm text-foreground" data-testid="insights-metadata-header">
          Analyzed {sessionsCount} Claude Code sessions across {ticketsCount}{' '}
          tickets shipped between {formatDate(periodStart)} and{' '}
          {formatDate(periodEnd)}
        </p>
      </CardContent>
    </Card>
  );
}
