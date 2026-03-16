import { FeatureCard } from './feature-card';
import { CAPABILITY_ITEMS, getLandingSectionContent } from '@/components/landing/content';

const section = getLandingSectionContent('capabilities');

export function FeaturesGrid() {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="bg-background py-16 md:py-24 lg:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              {section.eyebrow}
            </p>
            <h2
              id="capabilities-heading"
              className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl"
            >
              {section.heading}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
              {section.supportingText}
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {CAPABILITY_ITEMS.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
