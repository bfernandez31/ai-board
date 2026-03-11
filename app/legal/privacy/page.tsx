import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - AI Board',
  description: 'Privacy Policy for AI Board',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-[hsl(var(--ctp-subtext-0))]">
        Effective Date: March 11, 2026
      </p>

      <div className="space-y-8 text-[hsl(var(--ctp-text))]">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Data Collected</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            When you sign in to AI Board using your GitHub account, we collect the following
            information from your GitHub profile: your display name, email address, and profile
            avatar. This information is used solely to identify you within the platform and to
            provide the services described on AI Board. We do not collect any additional personal
            data beyond what is provided through the OAuth sign-in process.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Cookies Used</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            AI Board uses session cookies provided by NextAuth.js to manage your authentication
            state. These cookies are strictly necessary for the functioning of the sign-in system
            and do not track your browsing activity across other websites. No third-party tracking
            cookies or analytics cookies are used.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. No Data Resale</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            We do not sell, rent, or share your personal data with third parties for commercial
            purposes. Your data is used exclusively to provide and improve the AI Board service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. GDPR Rights</h2>
          <p className="leading-relaxed text-[hsl(var(--ctp-subtext-1))]">
            If you are located in the European Economic Area (EEA), you have the right to access,
            correct, or delete your personal data. You may request the deletion of your account and
            all associated data by contacting us through a GitHub issue on the AI Board repository
            or by emailing our support team. We will process your request within 30 days in
            accordance with applicable data protection regulations.
          </p>
        </section>
      </div>
    </main>
  );
}
