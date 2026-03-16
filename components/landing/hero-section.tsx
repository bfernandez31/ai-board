import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AnimatedTicketBackground from '@/app/landing/components/animated-ticket-background';

export function HeroSection() {
  return (
    <section className="relative py-16 md:py-24 lg:py-32 overflow-hidden">
      {/* Animated background layer (behind content) */}
      <AnimatedTicketBackground className="absolute inset-0 -z-10" />

      {/* Decorative gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial from-primary/10 via-ctp-blue/5 to-transparent rounded-full blur-3xl -z-[5]" aria-hidden="true" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Gradient Title */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight bg-gradient-to-r from-ctp-mauve via-primary to-ctp-blue bg-clip-text text-transparent">
            Build Better Software with AI-Powered Workflows
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Transform tickets into production-ready features with AI-powered workflows. Streamline development from specification to deployment.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin">
              <Button size="lg" className="w-full sm:w-auto min-h-[44px] transform hover:scale-105 transition-transform">
                Get Started Free
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto min-h-[44px]">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
