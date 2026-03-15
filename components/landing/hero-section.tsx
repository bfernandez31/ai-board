import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedTicketBackground from '@/app/landing/components/animated-ticket-background';

export function HeroSection() {
  return (
    <section
      className="relative py-20 md:py-28 lg:py-36 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Animated background layer (behind content) */}
      <AnimatedTicketBackground className="absolute inset-0 -z-10" />

      {/* Subtle radial glow behind hero content */}
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,hsl(var(--primary)/0.12),transparent)]"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            AI-powered development workflows
          </div>

          {/* Gradient Title */}
          <h1
            id="hero-heading"
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 bg-gradient-to-r from-primary via-ctp-lavender to-ctp-blue bg-clip-text text-transparent leading-tight"
          >
            Build Better Software with AI
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Transform tickets into production-ready features. From specification to deployment, let AI handle the heavy lifting.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin">
              <Button
                size="lg"
                className="w-full sm:w-auto gap-2 text-base px-8 transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="#workflow">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-base px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Trust signal */}
          <p className="mt-8 text-sm text-muted-foreground">
            Free forever for solo developers &middot; No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}
