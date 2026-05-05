import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UsagePanelProps {
  analysedShipped: number;
  leftInbox: number;
  ratio: number;
}

export function UsagePanel({ analysedShipped, leftInbox, ratio }: UsagePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Analysed vs Shipped</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold font-mono">
          <span>{analysedShipped}</span>
          <span className="text-muted-foreground text-base font-normal"> analysed shipped</span>
        </div>
        <div className="text-lg font-mono">
          <span>{leftInbox}</span>
          <span className="text-muted-foreground text-sm font-normal"> tickets left INBOX</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Ratio: <span className="font-mono font-semibold">{ratio.toFixed(3)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
