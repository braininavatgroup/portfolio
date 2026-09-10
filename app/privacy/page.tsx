import { shareMetadata } from "../../lib/portfolio-sharing";
import Link from "next/link";
import { PortfolioAnalyticsPreference } from "../../components/PortfolioAnalytics";
import { portfolioContact, portfolioInterfaceText } from "../../lib/portfolio-world";

export const metadata = shareMetadata("privacy");

export default function PrivacyPage() {
  return (
    <main className="privacy-page" id="main-content" tabIndex={-1}>
      <Link href="/">
        {portfolioInterfaceText["privacy.backLink"]}
      </Link>
      <h1>{portfolioInterfaceText["privacy.title"]}</h1>
      <p>{portfolioInterfaceText["privacy.p1"]}</p>
      <p>{portfolioInterfaceText["privacy.p2"]}</p>
      <p>{portfolioInterfaceText["privacy.p3"]}</p>
      <section
        aria-label="Analytics preferences"
        className="privacy-analytics-preference"
      >
        <PortfolioAnalyticsPreference />
      </section>
      <p>
        {portfolioInterfaceText["privacy.questionsPrefix"]}{" "}
        <a href={`mailto:${portfolioContact.email}`}>
          {portfolioContact.email}
        </a>
        .
      </p>
    </main>
  );
}
