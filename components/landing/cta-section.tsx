import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-r from-ctp-mauve/20 via-primary/20 to-ctp-blue/20" data-testid="final-cta-section">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join teams building better software with AI-powered development workflows.
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="transform hover:scale-105 transition-transform">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
