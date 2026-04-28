'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import type { SerializedAnchor } from '@/lib/analysis/serialize';

export interface AnchorCitationListProps {
  projectId: number;
  anchors: SerializedAnchor[];
}

function frictionLabel(frictionFree: boolean): string {
  return frictionFree ? 'friction-free' : 'had friction';
}

export function AnchorCitationList({ projectId, anchors }: AnchorCitationListProps) {
  if (anchors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="anchor-list-empty">
        No anchor citations.
      </p>
    );
  }

  return (
    <ul
      className="space-y-2 text-sm"
      data-testid="anchor-citation-list"
      aria-label="Anchor citations"
    >
      {anchors.map((anchor) => {
        if (anchor.tombstoned) {
          return (
            <li
              key={anchor.ticketId}
              data-testid={`anchor-${anchor.ticketKey}`}
              data-tombstoned="true"
              className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-muted-foreground"
            >
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span>{anchor.ticketKey}</span>
              <span className="italic">— ticket no longer available</span>
            </li>
          );
        }

        const Icon = anchor.frictionFree ? CheckCircle2 : AlertCircle;
        const colorClass = anchor.frictionFree ? 'text-emerald-500' : 'text-amber-500';

        return (
          <li key={anchor.ticketId} data-testid={`anchor-${anchor.ticketKey}`}>
            <Link
              href={`/projects/${projectId}/board?ticket=${anchor.ticketKey}&modal=open`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Anchor ${anchor.ticketKey}, ${frictionLabel(anchor.frictionFree)}, quality score ${anchor.qualityScore ?? 'no score'}`}
            >
              <Icon className={`h-4 w-4 ${colorClass}`} aria-hidden="true" />
              <span className="font-mono text-xs text-foreground">{anchor.ticketKey}</span>
              <span className="text-xs text-muted-foreground">
                {frictionLabel(anchor.frictionFree)}
              </span>
              <span className="ml-auto flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">
                  {anchor.qualityScore !== null ? `score ${anchor.qualityScore}` : 'no score'}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
