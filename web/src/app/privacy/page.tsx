// src/app/privacy/page.tsx
// Privacy Policy page for DiamondInsights
'use client';

import styles from './page.module.css';

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <div className={styles.document}>
          <section className={styles.section}>
            <h2>1. Introduction</h2>
            <p>
              DiamondInsights is owned and operated by Golden Bear Labs LLC (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). Golden Bear Labs LLC is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
            <p>
              By using DiamondInsights, you consent to the data practices described in this policy.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Information We Collect</h2>
            <h3>2.1 Information You Provide</h3>
            <p>We collect information you voluntarily provide, including:</p>
            <ul>
              <li>Account registration data (email, username, profile picture)</li>
              <li>User-generated content (comments, community posts)</li>
              <li>Virtual investment tracking data</li>
              <li>Communication with our support team</li>
            </ul>

            <h3>2.2 Automatically Collected Information</h3>
            <p>We automatically collect certain information, including:</p>
            <ul>
              <li>Usage analytics and app interactions</li>
              <li>Device and browser information</li>
              <li>IP address and approximate location</li>
              <li>Session data and preferences</li>
            </ul>

            <h3>2.3 MLB The Show Game Data</h3>
            <p>
              Our service processes publicly available MLB The Show player statistics and ratings for prediction analysis. 
              This game data is not personal information.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and maintain our service</li>
              <li>Generate AI-powered predictions and analytics</li>
              <li>Enable community features and user interactions</li>
              <li>Improve our algorithms and user experience</li>
              <li>Send service-related communications</li>
              <li>Ensure security and prevent abuse</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Firebase Integration</h2>
            <p>
              DiamondInsights uses Google Firebase services for authentication, database, and storage. Firebase processes 
              your data according to Google&apos;s privacy policies and security standards.
            </p>
            <p>Key Firebase services we use:</p>
            <ul>
              <li><strong>Firebase Authentication:</strong> Manages user accounts and login sessions</li>
              <li><strong>Firestore Database:</strong> Stores user profiles, predictions, and community content</li>
              <li><strong>Firebase Storage:</strong> Hosts profile pictures and app assets</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Information Sharing</h2>
            <p>We do not sell or rent your personal information to third parties. We may share information in these limited circumstances:</p>
            <ul>
              <li><strong>With your consent:</strong> When you explicitly authorize sharing</li>
              <li><strong>Public content:</strong> Community posts and public profiles are visible to other users</li>
              <li><strong>Service providers:</strong> With trusted partners who help operate our service (like Firebase)</li>
              <li><strong>Legal compliance:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information, including:
            </p>
            <ul>
              <li>Encryption of data in transit and at rest</li>
              <li>Firebase security rules and access controls</li>
              <li>Regular security assessments and updates</li>
              <li>Secure authentication and session management</li>
            </ul>
            <p>
              However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Your Privacy Rights</h2>
            <h3>7.1 General Rights</h3>
            <p>You have the right to:</p>
            <ul>
              <li>Access and review your personal information</li>
              <li>Update or correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Export your data in a machine-readable format</li>
              <li>Control your privacy settings and preferences</li>
            </ul>

            <h3>7.2 GDPR Rights (EU Residents)</h3>
            <p>If you are located in the EU, you have additional rights under GDPR, including:</p>
            <ul>
              <li>Right to data portability</li>
              <li>Right to restriction of processing</li>
              <li>Right to object to processing</li>
              <li>Right to lodge a complaint with supervisory authorities</li>
            </ul>

            <h3>7.3 CCPA Rights (California Residents)</h3>
            <p>California residents have the right to:</p>
            <ul>
              <li>Know what personal information is collected and how it&apos;s used</li>
              <li>Delete personal information held by us</li>
              <li>Opt-out of the sale of personal information (we don&apos;t sell personal info)</li>
              <li>Non-discrimination for exercising privacy rights</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>8. Cookies and Tracking</h2>
            <h3>8.1 Essential Cookies</h3>
            <p>
              We use essential cookies to enable core functionality like user authentication and session management. 
              These cookies are necessary for the service to function.
            </p>

            <h3>8.2 Analytics and Performance</h3>
            <p>
              We may use analytics services to understand how users interact with our service. 
              These services may collect information about your usage patterns.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Children&apos;s Privacy</h2>
            <p>
              DiamondInsights is not intended for children under 13. We do not knowingly collect 
              personal information from children under 13. If you believe we have collected information 
              from a child under 13, please contact us immediately.
            </p>
            <p>
              Users between 13-18 should have parental consent before using our service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. International Data Transfers</h2>
            <p>
              Your information may be processed in countries other than your own. We ensure adequate 
              protection through appropriate safeguards like data processing agreements 
              and standard contractual clauses.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Changes to Privacy Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of any material changes 
              by posting the new policy on this page and updating the &quot;last updated&quot; date. 
              Continued use of the service after changes constitutes acceptance of the new policy.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Contact Information</h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your privacy rights, 
              please contact Golden Bear Labs LLC at:
            </p>
            <p>
              <strong>Golden Bear Labs LLC - Privacy Officer</strong><br/>
              Email: admin@goldenbearlabs.com<br/>
              Website: https://diamondinsights.app<br/>
            </p>
            <p>
              <strong>Data Protection Officer (EU inquiries):</strong><br/>
              Email: admin@goldenbearlabs.com
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}