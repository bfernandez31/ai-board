import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - AI Board',
  description: 'Terms of Service for the AI Board platform',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] py-12 md:py-16" data-testid="terms-of-service-page">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-[hsl(var(--ctp-text))] mb-8">
          Terms of Service
        </h1>
        <p className="text-sm text-[hsl(var(--ctp-subtext-0))] mb-8">
          Last updated: March 11, 2026
        </p>

        <div className="space-y-8 text-[hsl(var(--ctp-subtext-1))]">
          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using AI Board (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              2. Description of Service
            </h2>
            <p>
              AI Board is a kanban-style project management platform that uses AI agents to automate
              software development workflows. The Service integrates with third-party services
              including GitHub and AI model providers to generate code, specifications, and other
              development artifacts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              3. User Accounts
            </h2>
            <p>
              You must authenticate via a supported OAuth provider (currently GitHub) to use the
              Service. You are responsible for maintaining the security of your account and for all
              activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              4. API Keys and Costs (BYOK)
            </h2>
            <p>
              AI Board operates on a Bring Your Own Key (BYOK) model. You provide your own API keys
              for AI model providers. You are solely responsible for any costs incurred through the
              use of your API keys, including but not limited to token usage, API call fees, and any
              overages. AI Board does not control, monitor, or limit your API usage beyond the
              features provided in the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              5. AI-Generated Content
            </h2>
            <p>
              The Service uses AI to generate code, specifications, documentation, and other content.
              You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                AI-generated code and content is provided &quot;as is&quot; without any warranty of
                correctness, completeness, or fitness for a particular purpose.
              </li>
              <li>
                You are solely responsible for reviewing, testing, and validating all AI-generated
                code before deploying it to production or any other environment.
              </li>
              <li>
                AI Board is not liable for any damages, losses, or issues arising from the use of
                AI-generated code or content.
              </li>
              <li>
                You retain ownership of the code generated through the Service using your
                repositories and API keys.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              6. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorized access to the Service or its related systems.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>
                Use the Service to generate malicious code, malware, or content intended to cause
                harm.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              7. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, AI Board and its operators shall not
              be liable for any indirect, incidental, special, consequential, or punitive damages,
              including but not limited to loss of profits, data, or business opportunities, arising
              out of or in connection with your use of the Service. This includes, without
              limitation, damages resulting from AI-generated code, API key usage costs, or
              third-party service failures.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              8. Service Availability
            </h2>
            <p>
              AI Board is provided on an &quot;as available&quot; basis. We do not guarantee
              uninterrupted or error-free operation of the Service. We reserve the right to modify,
              suspend, or discontinue the Service at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              9. Changes to Terms
            </h2>
            <p>
              We reserve the right to update these Terms of Service at any time. Continued use of the
              Service after changes constitutes acceptance of the updated terms. We will make
              reasonable efforts to notify users of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              10. Contact
            </h2>
            <p>
              If you have questions about these Terms of Service, please contact us through our{' '}
              <a
                href="https://github.com/bfernandez31/ai-board"
                className="text-[#8B5CF6] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[hsl(var(--ctp-surface-0))]">
          <Link
            href="/privacy-policy"
            className="text-[#8B5CF6] hover:underline text-sm"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
