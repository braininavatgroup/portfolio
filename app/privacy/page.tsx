import Link from "next/link";
import { PortfolioAnalyticsPreference } from "../../components/PortfolioAnalytics";
import { portfolioContact } from "../../lib/portfolio-world";

export default function PrivacyPage() {
  return (
    <main className="privacy-page" id="main-content" tabIndex={-1}>
      <Link href="/">← Portfolio</Link>
      <h1>Privacy</h1>
      <p>
        This site uses Cloudflare edge analytics for aggregate traffic and
        Microsoft Clarity for standard product analytics, performance
        reporting, heatmaps, and session replay.
      </p>
      <p>
        Analytics may include pages viewed, referral source, approximate
        geography, device and browser details, performance measurements,
        clicks, pointer movement, and scrolling. Form inputs and the portfolio
        chat are masked from session replay. The site does not use analytics
        for advertising or intentionally identify visitors by name.
      </p>
      <p>
        You can opt out or back in below. Your preference is stored in this
        browser.
      </p>
      <section
        aria-label="Analytics preferences"
        className="privacy-analytics-preference"
      >
        <PortfolioAnalyticsPreference />
      </section>
      <p>
        Questions? Email{" "}
        <a href={`mailto:${portfolioContact.email}`}>{portfolioContact.email}</a>.
      </p>
    </main>
  );
}
