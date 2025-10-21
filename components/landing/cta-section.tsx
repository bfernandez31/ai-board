import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-r from-[#8B5CF6]/20 via-[#6366F1]/20 to-[#3B82F6]/20" data-testid="final-cta-section">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--ctp-text))] mb-6">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-xl text-[hsl(var(--ctp-subtext-0))] mb-8">
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
