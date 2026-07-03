import { LegalLayout } from "./LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="How THEA collects, uses, protects, and shares information across our global intelligence platform, and the rights you have over your data."
      path="/privacy"
      lastUpdated="July 3, 2026"
    >
      <p>
        This Privacy Policy explains how THEA ("THEA", "we", "us", or "our") handles information in
        connection with the THEA intelligence platform, websites, and related services (collectively,
        the "Services"). We are committed to processing data responsibly and transparently.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information</strong> — name, work email, organization, and role you provide
          when creating an account or requesting a demo.
        </li>
        <li>
          <strong>Configuration data</strong> — watchlists, keywords, tracked entities, alert rules,
          and workspace settings you create while using the Services.
        </li>
        <li>
          <strong>Usage and device data</strong> — log data, IP address, browser type, pages viewed,
          and interactions, collected to operate and secure the Services.
        </li>
        <li>
          <strong>Monitored public content</strong> — publicly available media, news, and social
          signals that THEA ingests to produce intelligence. This is aggregated and analyzed to detect
          trends and sentiment, not to profile private individuals.
        </li>
      </ul>

      <h2>2. How We Use Information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide, maintain, and improve the Services and their intelligence outputs;</li>
        <li>Generate alerts, reports, trend detection, and analytics you configure;</li>
        <li>Authenticate users, secure accounts, and prevent abuse or fraud;</li>
        <li>Communicate with you about your account, updates, and support;</li>
        <li>Comply with legal obligations and enforce our agreements.</li>
      </ul>

      <h2>3. Legal Bases for Processing</h2>
      <p>
        Where applicable law requires a legal basis, we rely on the performance of our contract with
        you, our legitimate interests in operating a secure and effective intelligence platform, your
        consent where requested, and compliance with legal obligations.
      </p>

      <h2>4. How We Share Information</h2>
      <p>
        We do not sell your personal information. We share information only with service providers who
        process data on our behalf under contract, with your organization's authorized administrators,
        or where required by law or to protect our rights and users. Your watchlists, internal data,
        and generated statements are siloed to your organization.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain account and configuration data for as long as your account is active and as needed to
        provide the Services. Historical intelligence data is retained according to your plan's
        entitlements. We delete or anonymize data when it is no longer needed for these purposes.
      </p>

      <h2>6. Security</h2>
      <p>
        We maintain administrative, technical, and organizational safeguards designed to protect
        information, including encryption of data in transit and at rest and strict access controls.
        No method of transmission or storage is completely secure, and we cannot guarantee absolute
        security.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or port your
        personal information, or to object to or restrict certain processing. To exercise these rights,
        contact us using the details below. Requests are handled in accordance with applicable law.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        THEA operates globally, and information may be processed in countries other than your own. Where
        we transfer personal data across borders, we use appropriate safeguards consistent with
        applicable data protection laws.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be indicated by
        updating the "Last updated" date above and, where appropriate, by additional notice.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        Questions about this Policy or our data practices can be directed to our privacy team at{" "}
        <a href="mailto:privacy@thea.quest">privacy@thea.quest</a>.
      </p>
    </LegalLayout>
  );
}
