import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface PricingCardProps {
  name: string;
  price: number;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  isPopular?: boolean;
}

export function PricingCard({
  name,
  price,
  features,
  ctaLabel,
  ctaHref,
  isPopular,
}: PricingCardProps) {
  if (isPopular) {
    return (
      <div className="stagger-item relative rounded-lg p-[2px] bg-gradient-to-b from-ctp-mauve via-primary to-ctp-blue scale-[1.02] lg:scale-105 shadow-lg shadow-primary/25 animate-gradient-border">
        <Card className="relative flex flex-col h-full border-0 bg-ctp-mantle">
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-primary hover:bg-primary px-4 py-1 font-mono text-xs whitespace-nowrap">
            Most Popular
          </Badge>
          <CardHeader className="text-center pb-2">
            <h3 className="text-2xl font-bold text-primary">{name}</h3>
            <div className="mt-3">
              <span className="font-display text-6xl text-foreground">
                ${price / 100}
              </span>
              <span className="text-muted-foreground ml-1">/month</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full min-h-[44px]" size="lg">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <Card
      className="stagger-item relative flex flex-col transition-all hover:shadow-md hover:-translate-y-1"
    >
      <CardHeader className="text-center pb-2">
        <h3 className="text-2xl font-bold text-foreground">{name}</h3>
        <div className="mt-3">
          <span className="font-display text-5xl text-foreground">
            {price === 0 ? 'Free' : `$${price / 100}`}
          </span>
          {price > 0 && (
            <span className="text-muted-foreground ml-1">/month</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild variant={price === 0 ? 'outline' : 'default'} className="w-full min-h-[44px]" size="lg">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
