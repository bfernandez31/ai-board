'use client';

import type { JSX } from 'react';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { FAQEntry } from '@/lib/marketing/pricing-content';
import { cn } from '@/lib/utils';

interface FaqProps {
  items: FAQEntry[];
}

export function Faq({ items }: FaqProps): JSX.Element {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <FaqItem key={item.id} entry={item} />
      ))}
    </div>
  );
}

function FaqItem({ entry }: { entry: FAQEntry }): JSX.Element {
  const [open, setOpen] = useState(entry.defaultExpanded);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        data-analytics-id={entry.analyticsId}
        className="flex w-full items-center justify-between rounded-lg border border-[#313244] bg-[#1e1e2e]/70 px-4 py-3 text-left text-[hsl(var(--ctp-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
      >
        <span className="text-base font-medium">{entry.question}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-[#cdd6f4] transition-transform duration-200',
            open ? 'rotate-180' : 'rotate-0'
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-b-lg border border-t-0 border-[#313244] bg-[#181825]/80 px-4 py-3 text-sm text-[hsl(var(--ctp-subtext-0))]">
        {entry.answer}
      </CollapsibleContent>
    </Collapsible>
  );
}
