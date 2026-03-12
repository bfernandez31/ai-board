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
    question: 'What does BYOK mean?',
    answer:
      'BYOK stands for Bring Your Own Key. On the Free plan, you provide your own API keys for AI services like Claude and Codex. Paid plans include API access so you can get started without managing your own keys.',
  },
  {
    question: 'Which AI agents are supported?',
    answer:
      'We support Claude by Anthropic and Codex by OpenAI as AI agents for automated development workflows. Both agents can generate specifications, implementation plans, and production-ready code.',
  },
  {
    question: 'How does the 14-day trial work?',
    answer:
      'Pro and Team plans include a 14-day free trial. You get full access to all plan features during the trial period. No charge until the trial ends, and you can cancel anytime.',
  },
  {
    question: 'Can I switch plans?',
    answer:
      'Yes, you can upgrade or downgrade your plan at any time from your billing settings. When upgrading, you get immediate access to the new plan features. When downgrading, changes take effect at the end of your current billing period.',
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
        Frequently Asked Questions
      </h3>
      <div className="divide-y divide-border">
        {FAQ_ITEMS.map((item) => (
          <FAQItem key={item.question} item={item} />
        ))}
      </div>
    </div>
  );
}
