'use client';

import { Sparkles } from 'lucide-react';

export function HeroBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-8 hero-badge-shimmer">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-sm font-medium text-primary">
        AI-Powered Development
      </span>
    </div>
  );
}
