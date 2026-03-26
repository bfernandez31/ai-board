import { HeroSection } from '@/components/landing/hero-section';
import { SocialProofSection } from '@/components/landing/social-proof-section';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { CTASection } from '@/components/landing/cta-section';
import { FadeInSection } from '@/components/landing/fade-in-section';

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
      <div id="main-content">
        <HeroSection />
        <div className="section-divider mx-auto max-w-4xl" />
        <FadeInSection>
          <SocialProofSection />
        </FadeInSection>
        <div className="section-divider mx-auto max-w-4xl" />
        <FadeInSection>
          <FeaturesGrid />
        </FadeInSection>
        <div className="section-divider mx-auto max-w-4xl" />
        <FadeInSection>
          <WorkflowSection />
        </FadeInSection>
        <div className="section-divider mx-auto max-w-4xl" />
        <FadeInSection>
          <PricingSection />
        </FadeInSection>
        <div className="section-divider mx-auto max-w-4xl" />
        <FadeInSection>
          <CTASection />
        </FadeInSection>
      </div>
    </div>
  );
}
