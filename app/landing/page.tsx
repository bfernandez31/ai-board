import { CTASection } from '@/components/landing/cta-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { HeroSection } from '@/components/landing/hero-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { WorkflowSection } from '@/components/landing/workflow-section';

export default function LandingPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <FeaturesGrid />
      <WorkflowSection />
      <PricingSection />
      <CTASection />
    </main>
  );
}
