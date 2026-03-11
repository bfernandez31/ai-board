import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - AI Board',
  description: 'Terms of Service for AI Board',
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-sm text-[hsl(var(--ctp-subtext-0))]">
        Effective Date: March 11, 2026
      </p>

      <div className="space-y-8 text-[hsl(var(--ctp-text))]">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Conditions of Use</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            By accessing and using AI Board, you accept and agree to be bound by these Terms of
            Service. If you do not agree to these terms, you must not use the platform. AI Board
            provides a visual kanban board for AI-driven software development. You must be at least
            18 years old or have the consent of a legal guardian to use this service. You are
            responsible for maintaining the confidentiality of your account credentials and for all
            activities that occur under your account.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Limitation of Liability</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            AI Board is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
            warranties of any kind, either express or implied. To the fullest extent permitted by
            applicable law, AI Board and its operators shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including but not limited to
            loss of profits, data, or business opportunities, arising out of or related to your use
            of the platform.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. BYOK API Cost Responsibility</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            AI Board operates on a Bring Your Own Key (BYOK) model. You are solely responsible for
            any costs incurred through the use of third-party API keys that you provide to the
            platform. AI Board does not control, monitor, or limit the usage of your API keys and
            accepts no liability for charges incurred by third-party API providers. You should
            monitor your API usage and set appropriate spending limits directly with your API
            providers.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. AI-Generated Code Responsibility</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            Code generated through AI Board is produced by AI models and is provided without any
            guarantee of correctness, security, or fitness for a particular purpose. You are solely
            responsible for reviewing, testing, and validating all AI-generated code before deploying
            it to any environment. AI Board disclaims all liability for damages arising from the use
            of AI-generated code, including but not limited to security vulnerabilities, data loss,
            or system failures.
          </p>
        </section>
      </div>
    </main>
  );
}
