// src/app/terms/page.tsx
// Terms of Service page for DiamondInsights
'use client';

import styles from './page.module.css';

export default function TermsPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <div className={styles.document}>
          <section className={styles.section}>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using DiamondInsights (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). 
              If you disagree with any part of these terms, then you may not access the Service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Description of Service</h2>
            <p>
              DiamondInsights is a web and mobile application that provides AI-powered predictions and analysis for MLB The Show player ratings. 
              The service includes virtual investment tracking, community features, and predictive analytics.
            </p>
            <p>
              <strong>Important Disclaimers:</strong>
            </p>
            <ul>
              <li>DiamondInsights is not affiliated with San Diego Studios or Major League Baseball</li>
              <li>All predictions are based on AI models and historical data - accuracy is not guaranteed</li>
              <li>Virtual investments are for entertainment purposes only and do not involve real money</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. User Accounts</h2>
            <p>
              To access certain features, you must create an account. You are responsible for safeguarding your account credentials 
              and for all activities that occur under your account.
            </p>
            <p>
              You must be at least 13 years old to create an account. Users between 13-18 should have parental consent.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Virtual Investment Tracking</h2>
            <p>
              Our investment tracking feature allows users to simulate investments in MLB The Show players using virtual currency. 
              <strong>These are not real financial investments and involve no actual money.</strong>
            </p>
            <p>
              Virtual portfolios are for entertainment and educational purposes only. DiamondInsights is not a financial advisor 
              and provides no investment advice.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. AI Predictions and Data</h2>
            <p>
              Our AI predictions are generated using machine learning models trained on historical MLB The Show data. 
              While we strive for accuracy, predictions are inherently uncertain and should not be relied upon for any 
              real-world decisions.
            </p>
            <p>
              Player ratings, statistics, and game data are sourced from publicly available information and user-contributed data.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Community Guidelines</h2>
            <p>Users must not:</p>
            <ul>
              <li>Post harmful, offensive, or inappropriate content</li>
              <li>Spam or harass other users</li>
              <li>Share false or misleading information</li>
              <li>Attempt to manipulate or exploit the service</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>7. Intellectual Property</h2>
            <p>
              DiamondInsights respects intellectual property rights. All content on our service is either owned by us, 
              our users, or used with permission.
            </p>
            <p>
              MLB The Show is a trademark of San Diego Studios. Player names, team names, and statistics may be subject 
              to various intellectual property rights.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Privacy</h2>
            <p>
              Your privacy is important to us. Please review our Privacy Policy to understand how we collect, 
              use, and protect your information.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Limitation of Liability</h2>
            <p>
              DiamondInsights is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages 
              arising from your use of the service, including but not limited to data loss, service interruptions, 
              or reliance on AI predictions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Termination</h2>
            <p>
              We may terminate or suspend your account at any time for violations of these terms or other reasons, 
              including without limitation if you breach the Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by 
              posting the new Terms on this page and updating the &quot;last updated&quot; date.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, 
              without regard to conflict of law provisions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>13. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p>
              Email: diamondinsights25@gmail.com<br/>
              Website: https://diamondinsights.app
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}