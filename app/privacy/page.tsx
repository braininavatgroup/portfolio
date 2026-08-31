import Link from "next/link";
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
        Use the analytics control at the bottom of the site to opt out or back
        in. Your preference is stored in this browser.
      </p>
      <p>
        Questions? Email{" "}
        <a href={`mailto:${portfolioContact.email}`}>{portfolioContact.email}</a>.
      </p>
    </main>
  );
}
