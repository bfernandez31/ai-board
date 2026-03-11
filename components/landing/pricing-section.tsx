import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FAQSection } from '@/components/landing/faq-section';

// Static plan data aligned with lib/billing/plans.ts (source of truth for pricing)
const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: [
      '1 project',
      '5 tickets per month',
      'BYOK API key required',
      'Community support',
    ],
    cta: 'Get Started',
    ctaHref: '/auth/signin',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$15',
    period: '/month',
    features: [
      'Unlimited projects',
      'Unlimited tickets',
      '14-day free trial',
      'Priority support',
    ],
    cta: 'Start 14-day trial',
    ctaHref: '/auth/signin',
    popular: true,
  },
  {
    name: 'Team',
    price: '$30',
    period: '/month',
    features: [
      'Everything in Pro',
      'Up to 10 project members',
      'Advanced analytics',
      '14-day free trial',
    ],
    cta: 'Start 14-day trial',
    ctaHref: '/auth/signin',
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-16 md:py-24">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[hsl(var(--ctp-text))] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-[hsl(var(--ctp-subtext-0))] max-w-2xl mx-auto">
            Choose the plan that fits your team
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`bg-[#181825] flex flex-col ${
                plan.popular
                  ? 'border-[#8B5CF6] border-2 relative'
                  : 'border-[#313244]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#8B5CF6] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <h3 className="text-xl font-semibold text-[hsl(var(--ctp-text))]">
                  {plan.name}
                </h3>
                <div className="mt-2">
                  <span className="text-4xl font-bold text-[hsl(var(--ctp-text))]">
                    {plan.price}
                  </span>
                  <span className="text-[hsl(var(--ctp-subtext-0))]">
                    {plan.period}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-[hsl(var(--ctp-subtext-0))]">
                      <Check className="h-4 w-4 text-[#8B5CF6] shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.ctaHref} className="mt-auto">
                  <Button
                    variant={plan.popular ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <FAQSection />
      </div>
    </section>
  );
}
