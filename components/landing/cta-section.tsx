import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section
      className="relative py-16 md:py-24 lg:py-32 overflow-hidden"
      data-testid="final-cta-section"
      aria-labelledby="cta-heading"
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/10 via-ctp-lavender/10 to-ctp-blue/10"
        aria-hidden="true"
      />
      {/* Decorative grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:4rem_4rem]"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            id="cta-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6"
          >
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
            Join teams building better software with AI-powered development workflows.
          </p>
          <Link href="/auth/signin">
            <Button
              size="lg"
              className="gap-2 text-base px-8 transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
