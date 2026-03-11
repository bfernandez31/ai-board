'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
};

type Faq = {
  question: string;
  answer: string;
};

const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Get started with AI-powered development',
    features: [
      '1 project',
      '5 tickets per month',
      'BYOK API key required',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/auth/signin',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$15',
    period: '/month',
    description: 'For professional developers and small teams',
    features: [
      'Unlimited projects',
      'Unlimited tickets',
      '14-day free trial',
      'Priority support',
    ],
    cta: 'Start 14-day trial',
    href: '/auth/signin',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$30',
    period: '/month',
    description: 'For teams that need collaboration and analytics',
    features: [
      'Everything in Pro',
      'Up to 10 members per project',
      'Advanced analytics',
      '14-day free trial',
    ],
    cta: 'Start 14-day trial',
    href: '/auth/signin',
    highlighted: false,
  },
];

const faqs: Faq[] = [
  {
    question: 'What is BYOK (Bring Your Own Key)?',
    answer:
      'On the Free plan, you provide your own API key for AI providers (e.g., Anthropic, OpenAI). Pro and Team plans include managed API access.',
  },
  {
    question: 'Which AI agents are supported?',
    answer:
      'AI Board supports Claude Code (Anthropic) and Codex (OpenAI) as workflow agents. You can configure the agent per ticket.',
  },
];

const baseCardClasses = 'relative rounded-2xl border p-8 flex flex-col';
const highlightedCardClasses =
  'border-[#8B5CF6] bg-[#8B5CF6]/5 shadow-lg shadow-[#8B5CF6]/10';
const standardCardClasses =
  'border-[hsl(var(--ctp-surface-0))] bg-[hsl(var(--ctp-surface-0))]/30';

export function PricingSection(): JSX.Element {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function handleFaqToggle(index: number): void {
    setOpenFaq((current) => (current === index ? null : index));
  }

  return (
    <section className="py-16 md:py-24 lg:py-32" data-testid="pricing-section">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--ctp-text))] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-[hsl(var(--ctp-subtext-0))] max-w-2xl mx-auto">
            Choose the plan that fits your workflow. All plans include the full
            AI-powered development pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {plans.map((plan) => {
            const cardClasses = `${baseCardClasses} ${
              plan.highlighted ? highlightedCardClasses : standardCardClasses
            }`;
            const buttonVariant = plan.highlighted ? 'default' : 'outline';

            return (
              <div
                key={plan.name}
                className={cardClasses}
                data-testid={`pricing-card-${plan.name.toLowerCase()}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8B5CF6] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-2">
                  {plan.name}
                </h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-[hsl(var(--ctp-text))]">
                    {plan.price}
                  </span>
                  <span className="text-[hsl(var(--ctp-subtext-0))]">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-[hsl(var(--ctp-subtext-0))] mb-6">
                  {plan.description}
                </p>
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-[hsl(var(--ctp-text))]"
                    >
                      <Check className="h-4 w-4 text-[#8B5CF6] shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button className="w-full" variant={buttonVariant}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-semibold text-[hsl(var(--ctp-text))] text-center mb-8">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={faq.question}
                  className="border border-[hsl(var(--ctp-surface-0))] rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => handleFaqToggle(index)}
                    className="w-full flex items-center justify-between p-4 text-left text-[hsl(var(--ctp-text))] hover:bg-[hsl(var(--ctp-surface-0))]/30 transition-colors rounded-lg"
                    data-testid={`faq-toggle-${index}`}
                  >
                    <span className="font-medium">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-sm text-[hsl(var(--ctp-subtext-0))]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
