'use client'

import Head from 'next/head'
import styles from './page.module.css'
import { FaBrain, FaChartLine, FaDatabase, FaRocket } from 'react-icons/fa'
import { FaLightbulb } from 'react-icons/fa6'

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>How It Works & About Us | DiamondInsights</title>
        <meta
          name="description"
          content="Learn how our AI models predict MLB The Show player ratings and meet our team"
        />
      </Head>
      
      <main className={styles.aboutContainer}>
        {/* Hero */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              How Our <span>AI Predictions</span> Work
            </h1>
            <p className={styles.heroSubtitle}>
              Transparent, data-driven forecasting for MLB The Show roster updates
            </p>
          </div>
        </section>

        {/* Methodology */}
        <section className={styles.explanationSection}>
          <div className={styles.sectionHeader}>
            <h2>Our Prediction Methodology</h2>
            <p>Advanced machine learning for accurate player-rating forecasts</p>
          </div>

          <div className={styles.processSteps}>
            <div className={styles.step}>
              <div className={styles.stepIcon}><FaDatabase /></div>
              <h3>Historical Data Training</h3>
              <p>
                We analyze years of player statistics and roster update patterns to identify meaningful trends.
              </p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepIcon}><FaChartLine /></div>
              <h3>Attribute-Level Predictions</h3>
              <p>
                For each player, we forecast changes to individual skills (7 for batters, 6 for pitchers)
                with an average error of just 2 rating points per attribute.
              </p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepIcon}><FaLightbulb /></div>
              <h3>Overall Rating Calculation</h3>
              <p>
                We combine those attribute forecasts into a new overall rating,
                maintaining an average error of about 1 rating point.
              </p>
            </div>
          </div>

          <div className={styles.noteBox}>
            <FaBrain className={styles.noteIcon} />
            <p>
              While we can&apos;t reveal all our proprietary techniques, we&apos;re committed to
              transparency about our core methodology. Our models are continuously refined
              as new data becomes available.
            </p>
          </div>
        </section>

        {/* Team */}
        <section className={styles.teamSection}>

          <div className={styles.missionStatement}>
            <h3>Our Mission</h3>
            <p>
              We founded DiamondInsights to solve the frustration of unpredictable roster updates.
              By combining professional sports analytics experience with cutting-edge machine learning,
              we&apos;ve created the most accurate prediction system available for MLB The Show investors.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaContent}>
            <h2>Ready to Transform Your MLB The Show Strategy?</h2>
            <p>Join thousands of investors using our AI-powered predictions</p>
            <a href="/signup" className={`${styles.ctaButton} ${styles.primaryButton}`}>
              <FaRocket /> Get Started Free
            </a>
          </div>
        </section>
      </main>
    </>
  )
}
