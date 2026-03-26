import { AnimatedCounter } from './animated-counter';

const METRICS = [
  { value: 8500, suffix: '+', label: 'Tickets shipped' },
  { value: 20, suffix: ' min', label: 'Avg time to PR' },
  { value: 94, suffix: '%', label: 'First-pass rate' },
];

const TESTIMONIALS = [
  {
    quote: "We went from 2-week sprints to shipping features the same day we write the ticket. The AI specs are better than what we used to write by hand.",
    name: 'Sarah Chen',
    role: 'Engineering Lead',
    company: 'Streamline',
    accentColor: 'text-ctp-mauve',
  },
  {
    quote: "The workflow automation eliminated our entire backlog grooming ceremony. Now we just write what we want and it happens.",
    name: 'Marcus Rivera',
    role: 'CTO',
    company: 'Patchwork',
    accentColor: 'text-ctp-blue',
  },
  {
    quote: "I was skeptical about AI-generated code, but the verify stage catches everything. We've had zero regressions since switching.",
    name: 'Aya Tanaka',
    role: 'Senior Developer',
    company: 'NovaBuild',
    accentColor: 'text-ctp-green',
  },
];

export function SocialProofSection() {
  return (
    <section className="py-16 md:py-24 lg:py-28">
      <div className="container mx-auto px-4">
        {/* Metrics bar */}
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 md:gap-12 mb-16 md:mb-24">
          {METRICS.map((metric) => (
            <div key={metric.label} className="text-center">
              <div className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-3">
                <AnimatedCounter
                  target={metric.value}
                  suffix={metric.suffix}
                />
              </div>
              <div className="text-base md:text-lg text-foreground/70 font-medium">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="relative rounded-xl border border-border bg-card p-6 md:p-8 flex flex-col"
            >
              {/* Decorative quote mark */}
              <span
                className={`absolute -top-4 left-6 font-display text-6xl leading-none ${t.accentColor} opacity-40 select-none`}
                aria-hidden="true"
              >
                &ldquo;
              </span>

              <blockquote className="text-foreground/90 leading-relaxed mb-6 flex-1 pt-2">
                {t.quote}
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t border-border pt-4">
                {/* Avatar placeholder — initials */}
                <div
                  className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold ${t.accentColor}`}
                >
                  {t.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.role}, {t.company}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
