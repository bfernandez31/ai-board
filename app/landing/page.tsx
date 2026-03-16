import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { CTASection } from '@/components/landing/cta-section';

/**
 * Landing Page
 * Server Component container for marketing sections
 * Shown to unauthenticated visitors only
 * Uses main Header component with marketing variant
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <main id="main-content">
      <HeroSection />
      <FeaturesGrid />
      <WorkflowSection />
      <PricingSection />
      <CTASection />
      </main>
    </div>
  );
}
