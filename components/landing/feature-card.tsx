import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
}

export function FeatureCard({
  icon: Icon,
  iconClassName,
  title,
  description,
}: FeatureCardProps): React.JSX.Element {
  return (
    <article
      className="group rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
      data-testid="feature-card"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/80">
        <Icon className={`h-6 w-6 ${iconClassName}`} aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p>
    </article>
  );
}
