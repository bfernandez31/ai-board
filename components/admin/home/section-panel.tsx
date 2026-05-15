import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface SectionPanelProps {
  title: string;
  children: ReactNode;
}

export function SectionPanel({ title, children }: SectionPanelProps) {
  return (
    <Card className="aurora-bg-section">
      <CardContent className="p-4">
        <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}
