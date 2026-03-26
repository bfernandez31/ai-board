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
  const isFree = price === 0;
  const priceDisplay = isFree ? 'Free' : `$${price / 100}`;

  const card = (
    <Card
      className={`relative flex flex-col h-full ${
        isPopular ? 'border-0 bg-ctp-mantle' : 'transition-all hover:shadow-md hover:-translate-y-1'
      }`}
    >
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-primary hover:bg-primary px-4 py-1 font-mono text-xs whitespace-nowrap">
          Most Popular
        </Badge>
      )}
      <CardHeader className="text-center pb-2">
        <h3 className={`text-2xl font-bold ${isPopular ? 'text-primary' : 'text-foreground'}`}>
          {name}
        </h3>
        <div className="mt-3">
          <span className={`font-display text-foreground ${isPopular ? 'text-6xl' : 'text-5xl'}`}>
            {priceDisplay}
          </span>
          {!isFree && (
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
        <Button
          asChild
          variant={isFree ? 'outline' : 'default'}
          className="w-full min-h-[44px]"
          size="lg"
        >
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );

  if (isPopular) {
    return (
      <div className="stagger-item relative rounded-lg p-[2px] bg-gradient-to-b from-ctp-mauve via-primary to-ctp-blue scale-[1.02] lg:scale-105 shadow-lg shadow-primary/25 animate-gradient-border">
        {card}
      </div>
    );
  }

  return <div className="stagger-item">{card}</div>;
}
