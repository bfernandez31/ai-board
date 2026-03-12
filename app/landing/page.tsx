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
      <HeroSection />
      <FeaturesGrid />
      <WorkflowSection />
      <PricingSection />
      <CTASection />
    </div>
  );
}
