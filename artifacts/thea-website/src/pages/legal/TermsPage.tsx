import { LegalLayout } from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="The terms that govern your access to and use of the THEA intelligence platform and related services."
      path="/terms"
      lastUpdated="July 3, 2026"
    >
      <p>
        These Terms of Service ("Terms") govern your access to and use of the THEA platform, websites,
        and related services (the "Services"). By accessing or using the Services, you agree to these
        Terms. If you are using the Services on behalf of an organization, you represent that you are
        authorized to bind that organization.
      </p>

      <h2>1. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all
        activity that occurs under your account. You must provide accurate information and promptly
        update it as needed. Notify us immediately of any unauthorized use.
      </p>

      <h2>2. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Services to violate any applicable law or the rights of others;</li>
        <li>Reverse engineer, resell, or misuse the Services or their outputs beyond your entitlements;</li>
        <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Services;</li>
        <li>Use the intelligence outputs to unlawfully surveil, harass, or target individuals.</li>
      </ul>

      <h2>3. Subscriptions and Billing</h2>
      <p>
        Paid plans are billed in advance on the interval you select (monthly or annual). Unless
        otherwise stated, fees are non-refundable. Plan entitlements — including tracked entities,
        historical data access, and features — are described on our pricing page and may change with
        notice.
      </p>

      <h2>4. Intelligence Outputs</h2>
      <p>
        THEA produces analytics, alerts, and AI-generated drafts based on publicly available signals and
        your configuration. These outputs are provided for informational purposes to support your
        decision-making. You are responsible for reviewing outputs before acting on or publishing them.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        The Services, including all software, models, and content we provide, are owned by THEA and its
        licensors and are protected by intellectual property laws. We grant you a limited,
        non-exclusive, non-transferable right to use the Services in accordance with these Terms. You
        retain ownership of the configuration data and content you provide.
      </p>

      <h2>6. Confidentiality</h2>
      <p>
        Each party may access confidential information of the other. Both parties agree to protect such
        information and use it only as necessary to perform under these Terms.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Services are provided "as is" and "as available" without warranties of any kind, whether
        express or implied, including fitness for a particular purpose and non-infringement. We do not
        warrant that the Services will be uninterrupted, error-free, or that outputs will be complete or
        accurate.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, THEA will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits or revenues, arising out of or
        related to your use of the Services.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Services at any time. We may suspend or terminate access if you breach
        these Terms or if required to protect the Services or other users. Upon termination, your right
        to use the Services ceases.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be indicated by updating the
        "Last updated" date above. Continued use of the Services after changes take effect constitutes
        acceptance of the revised Terms.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Questions about these Terms can be directed to <a href="mailto:legal@thea.quest">legal@thea.quest</a>.
      </p>
    </LegalLayout>
  );
}
