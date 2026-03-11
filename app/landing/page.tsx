import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { CTASection } from '@/components/landing/cta-section';
import { PricingSection } from '@/components/landing/pricing-section';
import type { JSX } from 'react';

export default function LandingPage(): JSX.Element {
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
