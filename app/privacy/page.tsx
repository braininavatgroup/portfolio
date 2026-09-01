import Link from "next/link";
import { PortfolioAnalyticsPreference } from "../../components/PortfolioAnalytics";
import { EditableText } from "../../components/editor/EditableText";
import { portfolioContact, portfolioInterfaceText } from "../../lib/portfolio-world";

export default function PrivacyPage() {
  return (
    <main className="privacy-page" id="main-content" tabIndex={-1}>
      <Link href="/">
        <EditableText
          path="interface.privacy.backLink"
          value={portfolioInterfaceText["privacy.backLink"]}
        />
      </Link>
      <EditableText
        as="h1"
        path="interface.privacy.title"
        value={portfolioInterfaceText["privacy.title"]}
      />
      <EditableText
        as="p"
        multiline
        path="interface.privacy.p1"
        value={portfolioInterfaceText["privacy.p1"]}
      />
      <EditableText
        as="p"
        multiline
        path="interface.privacy.p2"
        value={portfolioInterfaceText["privacy.p2"]}
      />
      <EditableText
        as="p"
        multiline
        path="interface.privacy.p3"
        value={portfolioInterfaceText["privacy.p3"]}
      />
      <section
        aria-label="Analytics preferences"
        className="privacy-analytics-preference"
      >
        <PortfolioAnalyticsPreference />
      </section>
      <p>
        <EditableText
          path="interface.privacy.questionsPrefix"
          value={portfolioInterfaceText["privacy.questionsPrefix"]}
        />{" "}
        <a href={`mailto:${portfolioContact.email}`}>
          <EditableText path="contact.email" value={portfolioContact.email} />
        </a>
        .
      </p>
    </main>
  );
}
