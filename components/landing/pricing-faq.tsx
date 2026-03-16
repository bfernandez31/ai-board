'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

interface FAQItemData {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItemData[] = [
  {
    question: 'How should I think about the Free plan?',
    answer:
      'Free is designed for evaluation and solo experimentation. You bring your own API keys, create a limited number of tickets each month, and verify whether the workflow fits your process before upgrading.',
  },
  {
    question: 'What changes when I move to Pro?',
    answer:
      'Pro keeps the same staged workflow but raises your throughput and removes the need to bring your own keys, which makes it easier to adopt the product as part of daily delivery.',
  },
  {
    question: 'When does Team make sense?',
    answer:
      'Team is for projects that need shared access, more members, and better visibility across the same ticket-to-ship process. It is the collaboration tier rather than a different product path.',
  },
  {
    question: 'Do I need to relearn the workflow when upgrading?',
    answer:
      'No. The stage model stays consistent across plans, so upgrading changes capacity and collaboration options more than it changes how work moves through the board.',
  },
];

function FAQItem({ item }: { item: FAQItemData }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-4 text-left text-foreground font-medium hover:text-primary transition-colors">
        {item.question}
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="pb-4 text-muted-foreground">{item.answer}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PricingFAQ() {
  return (
    <div className="mt-16 max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold text-center text-foreground mb-8">
        Pricing questions teams ask before they switch
      </h3>
      <div className="divide-y divide-border">
        {FAQ_ITEMS.map((item) => (
          <FAQItem key={item.question} item={item} />
        ))}
      </div>
    </div>
  );
}
