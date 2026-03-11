import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Get started with AI-powered development',
    features: [
      '1 project',
      '5 tickets per month',
      'BYOK API key required',
      'Full workflow (INBOX to SHIP)',
      'Git platform integration',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$15',
    period: '/month',
    description: 'For individual developers shipping faster',
    features: [
      'Unlimited projects',
      'Unlimited tickets',
      'BYOK API key required',
      'Full workflow (INBOX to SHIP)',
      'Git platform integration',
      '14-day free trial',
    ],
    cta: 'Start 14-day trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$30',
    period: '/month',
    description: 'For teams building together',
    features: [
      'Everything in Pro',
      'Up to 10 project members',
      'Advanced analytics',
      'Team collaboration',
      '14-day free trial',
    ],
    cta: 'Start 14-day trial',
  },
];

const faqs = [
  {
    question: 'What is BYOK (Bring Your Own Key)?',
    answer:
      'All plans require you to provide your own API keys for AI providers (e.g., Anthropic, OpenAI). AI-Board orchestrates the workflows — you control and pay for AI usage directly.',
  },
  {
    question: 'Which AI agents are supported?',
    answer:
      'AI-Board currently supports Claude (Anthropic) for specification, planning, and implementation workflows. More agents are planned.',
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-16 md:py-24 lg:py-32 bg-[hsl(var(--ctp-mantle))]">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-[hsl(var(--ctp-text))] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-[hsl(var(--ctp-subtext-0))] text-center mb-12 max-w-2xl mx-auto">
            Start free, scale as you grow. All plans include the full AI-powered workflow.
          </p>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`
                  relative rounded-lg border p-8 flex flex-col
                  ${
                    plan.highlighted
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 shadow-lg shadow-[#8B5CF6]/10'
                      : 'border-[hsl(var(--ctp-surface-0))] bg-[hsl(var(--ctp-base))]'
                  }
                `}
                data-testid={`pricing-card-${plan.name.toLowerCase()}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#8B5CF6] text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </div>
                )}

                <h3 className="text-xl font-bold text-[hsl(var(--ctp-text))] mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-[hsl(var(--ctp-text))]">
                    {plan.price}
                  </span>
                  <span className="text-[hsl(var(--ctp-subtext-0))]">{plan.period}</span>
                </div>
                <p className="text-sm text-[hsl(var(--ctp-subtext-0))] mb-6">
                  {plan.description}
                </p>

                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#a6e3a1]" />
                      <span className="text-sm text-[hsl(var(--ctp-text))]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/auth/signin">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-[hsl(var(--ctp-text))] mb-8">
              Frequently Asked Questions
            </h3>
            <div className="space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h4 className="text-base font-semibold text-[hsl(var(--ctp-text))] mb-2">
                    {faq.question}
                  </h4>
                  <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
