import Link from 'next/link';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';

type PricingPlan = {
  name: string;
  price: string;
  summary: string;
  ctaLabel: string;
  ctaVariant: 'default' | 'outline';
  features: string[];
  badge?: string;
  billingPeriod?: string;
  isHighlighted?: boolean;
};

type FaqItem = {
  question: string;
  answer: string;
};

type PlanCardProps = {
  plan: PricingPlan;
};

type FaqCardProps = {
  item: FaqItem;
};

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: 'Free',
    summary: 'For solo evaluation and small experiments.',
    ctaLabel: 'Get Started',
    ctaVariant: 'outline' as const,
    features: [
      'Create your first AI-managed project',
      'Basic ticket workflow automation',
      'Claude and Codex agent support',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    summary: 'For individuals shipping with AI every week.',
    ctaLabel: 'Start 14-day trial',
    ctaVariant: 'default' as const,
    badge: 'Most Popular',
    billingPeriod: '/month',
    isHighlighted: true,
    features: [
      'Unlimited active projects',
      'Faster implementation workflows',
      'Usage visibility and billing controls',
      'Priority support for production teams',
    ],
  },
  {
    name: 'Team',
    price: '$99',
    summary: 'For shared delivery across product and engineering.',
    ctaLabel: 'Start 14-day trial',
    ctaVariant: 'outline' as const,
    billingPeriod: '/month',
    features: [
      'Up to 10 project members',
      'Centralized team billing',
      'Shared AI workflow visibility',
      'Built for multi-repository delivery',
    ],
  },
];

const faqItems: FaqItem[] = [
  {
    question: 'Bring your own key (BYOK)?',
    answer:
      'Use your own model credentials when you need direct provider access, while AI-BOARD continues to manage the workflow around delivery.',
  },
  {
    question: 'Which agents are supported?',
    answer:
      'Claude and Codex workflows are supported today, with the pricing tiers designed around the same ticket-to-ship pipeline.',
  },
];

function PlanCard({ plan }: PlanCardProps): React.JSX.Element {
  const cardClassName = plan.isHighlighted
    ? 'flex h-full flex-col border-border/70 border-primary shadow-lg shadow-primary/10'
    : 'flex h-full flex-col border-border/70 shadow-sm';

  return (
    <Card className={cardClassName}>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">{plan.name}</h3>
          {plan.badge ? <Badge>{plan.badge}</Badge> : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight text-foreground">{plan.price}</span>
            {plan.billingPeriod ? (
              <span className="pb-1 text-sm text-muted-foreground">{plan.billingPeriod}</span>
            ) : null}
          </div>
          <CardDescription className="text-sm leading-6">{plan.summary}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full" size="lg" variant={plan.ctaVariant}>
          <Link href="/auth/signin">{plan.ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function FaqCard({ item }: FaqCardProps): React.JSX.Element {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{item.question}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{item.answer}</p>
      </CardContent>
    </Card>
  );
}

export function PricingSection(): React.JSX.Element {
  return (
    <section
      id="pricing"
      className="border-y border-border/60 bg-gradient-to-b from-background via-background to-muted/30 py-16 md:py-24 lg:py-32"
      data-testid="pricing-section"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4">
              Pricing
            </Badge>
            <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Simple pricing for every stage
            </h2>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              Start free, upgrade when you need more throughput, and bring the whole team along when the workflow becomes core infrastructure.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item) => (
              <FaqCard key={item.question} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
