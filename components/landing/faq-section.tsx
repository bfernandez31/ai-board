'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

const faqItems = [
  {
    question: 'What does BYOK (Bring Your Own Key) mean?',
    answer:
      'Bring Your Own Key means that on the Free plan, you provide your own API key for AI agents. Paid plans (Pro and Team) include managed API access, so you don\'t need to supply your own key.',
  },
  {
    question: 'Which AI agents and models are supported?',
    answer:
      'AI-Board uses Claude by Anthropic, powered by Claude Code, for automated development workflows including specification, planning, implementation, and verification.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold text-[hsl(var(--ctp-text))] text-center mb-8">
        Frequently Asked Questions
      </h3>
      <div className="space-y-3">
        {faqItems.map((item, index) => (
          <Collapsible
            key={index}
            open={openIndex === index}
            onOpenChange={(open) => setOpenIndex(open ? index : null)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg bg-[#181825] border border-[#313244] px-4 py-3 text-left text-[hsl(var(--ctp-text))] hover:bg-[#1e1e2e] transition-colors">
              <span className="font-medium">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[hsl(var(--ctp-subtext-0))] transition-transform duration-200 ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-2 pb-3 text-[hsl(var(--ctp-subtext-0))]">
              {item.answer}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
