import { HeroSection } from '@/components/landing/hero-section';
import { ProofStrip } from '@/components/landing/proof-strip';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { CTASection } from '@/components/landing/cta-section';
import { LANDING_SECTION_ORDER } from '@/components/landing/content';

const sectionComponents = {
  hero: HeroSection,
  proof: ProofStrip,
  workflow: WorkflowSection,
  capabilities: FeaturesGrid,
  pricing: PricingSection,
  'final-cta': CTASection,
};

/**
 * Landing Page
 * Server Component container for marketing sections
 * Shown to unauthenticated visitors only
 * Uses main Header component with marketing variant
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {LANDING_SECTION_ORDER.map((sectionId) => {
        const SectionComponent = sectionComponents[sectionId];
        return <SectionComponent key={sectionId} />;
      })}
    </div>
  );
}
