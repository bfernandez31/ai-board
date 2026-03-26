import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AnimatedTicketBackground from '@/app/landing/components/animated-ticket-background';
import { HeroBadge } from './hero-badge';
import { TypewriterText } from './typewriter-text';

export function HeroSection() {
  return (
    <section className="relative py-20 md:py-28 lg:py-36 overflow-hidden">
      {/* Animated background layer (behind content) */}
      <AnimatedTicketBackground className="absolute inset-0 -z-10" />

      {/* Subtle noise grain overlay */}
      <div
        className="absolute inset-0 -z-[5] opacity-[0.03] pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Animated badge */}
          <HeroBadge />

          {/* Serif Display Title */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-ctp-mauve via-primary to-ctp-blue bg-clip-text text-transparent">
              From ticket to production.
            </span>
            <br />
            <TypewriterText
              text="Automatically."
              className="text-foreground"
              delay={800}
              speed={90}
            />
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Write a ticket. AI generates the spec, plans the architecture,
            writes the code, and opens a PR. You review and ship.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin">
              <Button size="lg" className="w-full sm:w-auto min-h-[44px] px-8 text-base transform hover:scale-105 transition-all hover:shadow-lg hover:shadow-primary/40">
                Start building
              </Button>
            </Link>
            <Link href="#workflow">
              <Button variant="outline" size="lg" className="w-full sm:w-auto min-h-[44px] px-8 text-base">
                See how it works
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
