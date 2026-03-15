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
  return (
    <Card
      className={`relative flex flex-col transition-all duration-300 ${
        isPopular
          ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]'
          : 'hover:border-muted-foreground/30'
      }`}
    >
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-primary hover:bg-primary">
          Most Popular
        </Badge>
      )}
      <CardHeader className="text-center">
        <h3 className="text-2xl font-bold text-foreground">{name}</h3>
        <div className="mt-2">
          <span className="text-4xl font-bold text-foreground">
            ${price / 100}
          </span>
          {price > 0 && (
            <span className="text-muted-foreground">/month</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3" role="list" aria-label={`${name} plan features`}>
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-ctp-green flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          size="lg"
          variant={isPopular ? 'default' : 'outline'}
        >
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
