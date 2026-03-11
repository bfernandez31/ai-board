import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - AI Board',
  description: 'Privacy Policy for AI Board',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-6 text-sm text-[hsl(var(--ctp-subtext-0))]">
        Last updated: March 11, 2026
      </p>

      <div className="space-y-8 text-[hsl(var(--ctp-subtext-0))]">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">1. Data We Collect</h2>
          <p>When you use AI Board, we collect the following information:</p>
          <ul className="ml-6 mt-2 list-disc space-y-1">
            <li>
              <strong className="text-white">GitHub profile information:</strong> your username,
              display name, email address, and avatar URL, as provided by GitHub OAuth
            </li>
            <li>
              <strong className="text-white">Project and ticket data:</strong> content you create
              within the Service, including project configurations, ticket descriptions, and
              generated artifacts
            </li>
            <li>
              <strong className="text-white">Usage data:</strong> basic analytics to improve the
              Service (e.g., feature usage, error logs)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">2. How We Use Your Data</h2>
          <p>Your data is used to:</p>
          <ul className="ml-6 mt-2 list-disc space-y-1">
            <li>Authenticate you and manage your account</li>
            <li>Provide and operate the Service</li>
            <li>Communicate important updates about the Service</li>
            <li>Improve the Service based on usage patterns</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">3. Data Sharing</h2>
          <p>
            We do not sell, rent, or share your personal data with third parties for marketing
            purposes. Your data may be shared only in the following cases:
          </p>
          <ul className="ml-6 mt-2 list-disc space-y-1">
            <li>With third-party AI providers when you use BYOK features (your API keys)</li>
            <li>With GitHub for authentication purposes</li>
            <li>If required by law or to protect the rights and safety of the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">4. Cookies</h2>
          <p>
            AI Board uses only essential cookies required for authentication (NextAuth.js session
            cookies). We do not use tracking cookies, advertising cookies, or third-party analytics
            cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">5. Data Security</h2>
          <p>
            We implement reasonable technical and organizational measures to protect your data.
            However, no method of transmission over the internet is 100% secure, and we cannot
            guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">
            6. Your Rights (GDPR)
          </h2>
          <p>If you are located in the European Economic Area, you have the right to:</p>
          <ul className="ml-6 mt-2 list-disc space-y-1">
            <li>
              <strong className="text-white">Access:</strong> request a copy of the personal data
              we hold about you
            </li>
            <li>
              <strong className="text-white">Rectification:</strong> request correction of
              inaccurate data
            </li>
            <li>
              <strong className="text-white">Erasure:</strong> request deletion of your personal
              data
            </li>
            <li>
              <strong className="text-white">Portability:</strong> request your data in a
              structured, machine-readable format
            </li>
            <li>
              <strong className="text-white">Objection:</strong> object to processing of your data
              in certain circumstances
            </li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, please open an issue on our GitHub repository or
            contact us directly.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">7. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. If you request account
            deletion, we will remove your personal data within 30 days, except where retention is
            required by law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">8. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for users under the age of 16. We do not knowingly collect
            personal data from children.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by posting a notice on the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">10. Contact</h2>
          <p>
            For privacy-related questions or to exercise your data rights, please open an issue on
            our GitHub repository.
          </p>
        </section>
      </div>
    </div>
  );
}
