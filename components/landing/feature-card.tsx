import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  iconClassName: string;
  accentClassName: string;
  title: string;
  description: string;
}

export function FeatureCard({
  icon: Icon,
  iconClassName,
  accentClassName,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10',
        accentClassName
      )}
      data-testid="feature-card"
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100', accentClassName)} />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/80">
          <Icon className={cn('h-6 w-6', iconClassName)} />
        </div>
        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
