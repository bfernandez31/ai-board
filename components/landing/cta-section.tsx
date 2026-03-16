import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-20 md:py-24 lg:py-28" data-testid="final-cta-section">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 shadow-xl">
          <div className="grid gap-8 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                Start Shipping
              </p>
              <h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Replace status chasing with visible momentum
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Bring the ticket, the AI workflow, and the final verification path into the same
                product so your team spends more energy shipping than translating context.
              </p>
            </div>

            <div className="flex flex-col gap-4 lg:min-w-64">
              <Button asChild size="lg" className="group w-full">
                <Link href="/auth/signin">
                  Launch your workspace
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-border bg-background/80">
                <Link href="#pricing">Review pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
