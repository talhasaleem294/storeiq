import { Link } from 'react-router-dom'

import { APP_NAME, ROUTES } from '@/lib/constants'

const CONTACT_EMAIL = 'support@storeiq.app'
const LAST_UPDATED = 'June 3, 2025'

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-heading">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-text">{children}</div>
    </section>
  )
}

export function Privacy(): JSX.Element {
  return (
    <div className="min-h-svh flex flex-col bg-bg">
      {/* Nav */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
        <Link to={ROUTES.LANDING} className="text-lg font-bold text-accent">
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="text-sm font-medium text-text hover:text-heading transition-colors"
          >
            Sign in
          </Link>
          <Link
            to={ROUTES.SIGNUP}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-heading">Privacy Policy</h1>
          <p className="mt-1 text-xs text-text">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Who We Are">
          <p>
            {APP_NAME} is a SaaS analytics tool that helps Shopify store owners track their profit
            and Meta ad performance in one dashboard. We are an independent software product, not
            affiliated with Shopify Inc. or Meta Platforms Inc.
          </p>
          <p>
            For questions about this policy, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. What Data We Collect">
          <p>We collect only what is necessary to provide the service:</p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <span className="font-medium text-heading">Account information</span> — your email
              address and password (hashed, never stored in plaintext) when you sign up.
            </li>
            <li>
              <span className="font-medium text-heading">Shopify order data</span> — order revenue,
              refund amounts, and order status pulled from your connected Shopify store via the
              Shopify Admin API. We do not collect customer names, addresses, or payment details.
            </li>
            <li>
              <span className="font-medium text-heading">Meta Ads data</span> — campaign names, ad
              spend, ROAS (Return on Ad Spend), CTR (Click-Through Rate), and campaign status pulled
              from your connected Meta Ads account via the Meta Marketing API using the{' '}
              <code className="rounded bg-surface px-1 text-xs">ads_read</code> permission. We do
              not collect audience data, creative content, or personally identifiable information
              about people who see your ads.
            </li>
            <li>
              <span className="font-medium text-heading">API access tokens</span> — OAuth tokens
              for Shopify and Meta are stored encrypted in our database and are never exposed to the
              browser or shared with any third party.
            </li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>Your data is used solely to provide the {APP_NAME} service:</p>
          <ul className="ml-4 list-disc space-y-2">
            <li>Display your profit dashboard (revenue, refunds, net profit)</li>
            <li>Display your Meta Ads performance (spend, ROAS, CTR, campaign status)</li>
            <li>Calculate aggregated metrics shown in your workspace</li>
          </ul>
          <p className="mt-3 font-medium text-heading">
            We do not sell, rent, or share your data with any third party for marketing or
            advertising purposes.
          </p>
        </Section>

        <Section title="4. Data Storage & Security">
          <p>
            All data is stored in a Supabase (PostgreSQL) database hosted in the AWS Tokyo region.
            Access to your data is enforced at the database level using Row Level Security — each
            workspace can only access its own data. API tokens for Shopify and Meta are stored
            server-side only and are never returned to the browser.
          </p>
          <p>
            We use industry-standard practices including HTTPS for all data in transit and
            encrypted storage for sensitive credentials.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>
            {APP_NAME} integrates with the following third-party services to operate:
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <span className="font-medium text-heading">Shopify</span> — we read order data from
              your store using OAuth. Shopify's privacy policy applies to data on their platform.
            </li>
            <li>
              <span className="font-medium text-heading">Meta (Facebook)</span> — we read ad
              performance data from your Meta Ads account using the{' '}
              <code className="rounded bg-surface px-1 text-xs">ads_read</code> permission. Meta's
              privacy policy applies to data on their platform.
            </li>
            <li>
              <span className="font-medium text-heading">Supabase</span> — our database and
              authentication provider. Data is stored in their managed PostgreSQL service.
            </li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your data for as long as your account is active. If you disconnect a Shopify
            or Meta integration, the associated API token is deleted immediately. If you delete your
            workspace, all associated order and ads data is permanently deleted.
          </p>
          <p>
            You can request full account deletion by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
            . We will delete all your data within 30 days.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul className="ml-4 list-disc space-y-2">
            <li>Access the data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Revoke Shopify or Meta access at any time from your Settings page — this
            immediately stops any further data sync</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            {APP_NAME} uses a single session cookie to keep you logged in. We do not use tracking
            cookies, analytics cookies, or third-party advertising cookies.
          </p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>
            {APP_NAME} is a business tool and is not directed at anyone under the age of 18. We do
            not knowingly collect data from minors.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            If we make material changes to this policy, we will update the "Last updated" date at
            the top and notify active users by email. Continued use of the service after changes
            are posted constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            For any privacy-related questions or requests, contact us at:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-text">
        © 2025 {APP_NAME}. Built for Shopify stores in Pakistan.
      </footer>
    </div>
  )
}
