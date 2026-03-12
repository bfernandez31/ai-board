import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { CTASection } from '@/components/landing/cta-section';

export default function LandingPage(): React.JSX.Element {
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
