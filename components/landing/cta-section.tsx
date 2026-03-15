import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section
      className="relative overflow-hidden py-20 md:py-24 lg:py-32"
      data-testid="final-cta-section"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-ctp-blue/10 to-ctp-lavender/20" />
      <div className="container mx-auto px-4">
        <div className="relative mx-auto max-w-4xl rounded-[2rem] border border-border/70 bg-card/80 px-6 py-12 text-center shadow-2xl shadow-primary/10 backdrop-blur md:px-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Start with less friction
          </p>
          <h2 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Ready to make AI work feel operational?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            Keep the same velocity goals, but give your team a clearer workflow, stronger review
            moments, and a landing experience that better reflects the product.
          </p>
          <Button asChild size="lg" className="group">
            <Link href="/auth/signin">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
