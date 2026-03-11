import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for solo builders evaluating AI Board with BYOK.',
    features: [
      'Bring your own key (BYOK)',
      'Unlimited quick-impl tickets',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/auth/signin',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'For lean teams that want automated workflows with guardrails.',
    features: [
      '2 concurrent AI agents',
      'Priority Slack support',
      'Workflow automations + analytics',
    ],
    cta: 'Start 14-day trial',
    href: '/auth/signin',
    popular: true,
  },
  {
    name: 'Team',
    price: '$79',
    description: 'Scale to entire orgs with collaboration and compliance controls.',
    features: [
      'Unlimited projects & seats',
      'Custom plan limits',
      'Dedicated success engineer',
    ],
    cta: 'Start 14-day trial',
    href: '/auth/signin',
    popular: false,
  },
] as const;

const faqs = [
  {
    question: 'How does Bring Your Own Key (BYOK) work?',
    answer:
      'Connect your own OpenAI, Anthropic, or Azure OpenAI keys. Usage is billed directly by your provider so you retain control over spend.',
  },
  {
    question: 'Which agents are supported today?',
    answer:
      'AI Board supports multi-agent flows using OpenAI o1/o3, Claude 3.x, Gemini 2.0 Flash, and local adapters. More agents are added monthly based on demand.',
  },
] as const;

export function PricingSection() {
  return (
    <section className="py-20" aria-labelledby="pricing-section-heading" data-testid="pricing-section">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8B5CF6] mb-3">Pricing</p>
          <h2 id="pricing-section-heading" className="text-4xl md:text-5xl font-bold text-[hsl(var(--ctp-text))] mb-4">
            Plans built for every AI delivery team
          </h2>
          <p className="text-lg text-[hsl(var(--ctp-subtext-0))]">
            Choose the workflow depth you need. All plans include secure BYOK, AI-first tooling, and the same dark theme UI.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              aria-label={`${plan.name} plan`}
              className={plan.popular ? 'md:-mt-4 md:mb-4' : ''}
            >
              <Card
                className={`h-full border border-white/10 bg-[hsl(var(--ctp-base))]/60 backdrop-blur ${
                  plan.popular ? 'border-[#8B5CF6] shadow-[0_10px_40px_rgba(139,92,246,0.3)]' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>
                    {plan.popular && <Badge className="bg-[#8B5CF6]/20 text-[#C4B5FD]">Most popular</Badge>}
                  </div>
                  <CardDescription className="text-base text-[hsl(var(--ctp-subtext-0))]">
                    {plan.description}
                  </CardDescription>
                  <p className="text-4xl font-bold text-[hsl(var(--ctp-text))]">
                    {plan.price}
                    <span className="text-base font-normal text-[hsl(var(--ctp-subtext-1))]">/month</span>
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-[hsl(var(--ctp-text))]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8B5CF6]/20 text-[#C4B5FD]">
                          <Check className="h-4 w-4" />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto pt-6">
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            </article>
          ))}
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-xl border border-white/5 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-xl font-semibold text-[hsl(var(--ctp-text))]">{faq.question}</h3>
              <p className="mt-3 text-[hsl(var(--ctp-subtext-0))]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
