import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - AI Board',
  description: 'Privacy Policy for the AI Board platform',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] py-12 md:py-16" data-testid="privacy-policy-page">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-[hsl(var(--ctp-text))] mb-8">
          Privacy Policy
        </h1>
        <p className="text-sm text-[hsl(var(--ctp-subtext-0))] mb-8">
          Last updated: March 11, 2026
        </p>

        <div className="space-y-8 text-[hsl(var(--ctp-subtext-1))]">
          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              1. Information We Collect
            </h2>
            <p className="mb-3">
              When you use AI Board, we collect the following information through your OAuth
              authentication:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">GitHub profile information</strong>:
                your name, username, avatar URL, and email address as provided by GitHub.
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Email address</strong>: used for
                account identification and notifications.
              </li>
            </ul>
            <p className="mt-3">
              We do not collect any additional personal information beyond what is provided through
              the OAuth authentication flow.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              2. How We Use Your Information
            </h2>
            <p>Your information is used solely for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Authenticating your identity and managing your account.</li>
              <li>Providing the core functionality of the Service (project management, ticket tracking, workflow automation).</li>
              <li>Sending notifications related to your projects and tickets.</li>
              <li>Improving the Service based on aggregated, anonymized usage patterns.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              3. Data We Do Not Sell
            </h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We do not
              share your data with advertisers or data brokers. Your data is used exclusively to
              provide and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              4. Cookies and Session Data
            </h2>
            <p>
              AI Board uses cookies strictly for authentication and session management through
              NextAuth.js. These cookies are:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Session cookies</strong>: required
                to keep you signed in. They expire when you sign out or after a period of inactivity.
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">CSRF tokens</strong>: used to
                protect against cross-site request forgery attacks.
              </li>
            </ul>
            <p className="mt-3">
              We do not use tracking cookies, analytics cookies, or any third-party advertising
              cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              5. API Keys
            </h2>
            <p>
              If you provide API keys for AI model providers, these keys are stored securely and used
              only to execute AI workflows on your behalf. We do not share your API keys with any
              third party. You can delete your API keys at any time through the Service settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              6. Data Storage and Security
            </h2>
            <p>
              Your data is stored in a PostgreSQL database with industry-standard security measures.
              We use encrypted connections (HTTPS) for all data transmission. While we implement
              reasonable security practices, no method of electronic storage is 100% secure, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              7. Your Rights (GDPR)
            </h2>
            <p>Under the General Data Protection Regulation (GDPR), you have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Access</strong>: request a copy of
                the personal data we hold about you.
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Rectification</strong>: request
                correction of inaccurate personal data.
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Erasure</strong>: request deletion
                of your personal data. You can delete your account and all associated data at any
                time.
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Portability</strong>: request your
                data in a machine-readable format.
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Objection</strong>: object to the
                processing of your personal data.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us through our GitHub repository.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              8. Third-Party Services
            </h2>
            <p>AI Board integrates with the following third-party services:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">GitHub</strong>: for authentication
                and repository access. Subject to{' '}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                  className="text-[#8B5CF6] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">Stripe</strong>: for payment
                processing. Subject to{' '}
                <a
                  href="https://stripe.com/privacy"
                  className="text-[#8B5CF6] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Stripe&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-[hsl(var(--ctp-text))]">AI model providers</strong>: when
                you provide API keys, requests are sent to the respective AI provider. Each
                provider&apos;s privacy policy applies to those interactions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes by posting a notice on the Service. Continued use of the Service
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[hsl(var(--ctp-text))] mb-3">
              10. Contact
            </h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights,
              please contact us through our{' '}
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
            href="/terms-of-service"
            className="text-[#8B5CF6] hover:underline text-sm"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
