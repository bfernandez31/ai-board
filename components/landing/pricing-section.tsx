import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { PLANS } from '@/lib/billing/plans';

const pricingPlans = [
  {
    config: PLANS.FREE,
    highlight: false,
    cta: 'Get Started',
    href: '/auth/signin',
  },
  {
    config: PLANS.PRO,
    highlight: true,
    cta: 'Start 14-day trial',
    href: '/auth/signin',
  },
  {
    config: PLANS.TEAM,
    highlight: false,
    cta: 'Start 14-day trial',
    href: '/auth/signin',
  },
];

const faqs = [
  {
    question: 'What is BYOK (Bring Your Own Key)?',
    answer:
      'BYOK lets you connect your own API keys for AI providers. On the Free plan, you need your own key to run AI workflows. Pro and Team plans include managed API access.',
  },
  {
    question: 'Which AI agents are supported?',
    answer:
      'AI-Board supports Claude (Anthropic) and Codex (OpenAI) as AI agents for specification, planning, and implementation workflows.',
  },
];

function formatPrice(cents: number): string {
  if (cents === 0) return '$0';
  return `$${cents / 100}`;
}

export function PricingSection() {
  return (
    <section id="pricing" className="py-16 md:py-24 lg:py-32 bg-[hsl(var(--ctp-mantle))]" data-testid="pricing-section">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-[hsl(var(--ctp-text))] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-[hsl(var(--ctp-subtext-0))] text-center mb-12 max-w-2xl mx-auto">
            Start free and scale as your team grows. No hidden fees.
          </p>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {pricingPlans.map(({ config, highlight, cta, href }) => (
              <Card
                key={config.plan}
                className={`relative flex flex-col ${
                  highlight
                    ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                    : 'border-border'
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-4">
                  <h3 className="text-lg font-semibold text-foreground">{config.name}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPrice(config.priceMonthly)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {config.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href={href} className="w-full">
                    <Button
                      className="w-full"
                      variant={highlight ? 'default' : 'outline'}
                    >
                      {cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-foreground mb-8">
              Frequently Asked Questions
            </h3>
            <div className="space-y-6">
              {faqs.map(({ question, answer }) => (
                <div key={question}>
                  <h4 className="text-base font-medium text-foreground mb-2">{question}</h4>
                  <p className="text-sm text-muted-foreground">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
