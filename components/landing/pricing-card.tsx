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
      className={`flex flex-col ${isPopular ? 'border-primary shadow-md' : ''}`}
    >
      <CardHeader className="text-center">
        {isPopular && (
          <Badge className="self-center mb-2 w-fit">Most Popular</Badge>
        )}
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
        <Button asChild className="w-full" size="lg">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
