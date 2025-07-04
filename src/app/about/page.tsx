'use client'

import Head from 'next/head'
import styles from './page.module.css'
import { FaBrain, FaChartLine, FaDatabase, FaUserGraduate, FaUserTie, FaRocket } from 'react-icons/fa'
import { FaLightbulb, FaShieldCat } from 'react-icons/fa6'

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>How It Works & About Us | DiamondInsights</title>
        <meta name="description" content="Learn how our AI models predict MLB The Show player ratings and meet our team" />
      </Head>
      
      <main className={styles.aboutContainer}>
        {/* Hero Section */}
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

        {/* How It Works Section */}
        <section className={styles.explanationSection}>
          <div className={styles.sectionHeader}>
            <h2>Our Prediction Methodology</h2>
            <p>Advanced machine learning for accurate player rating forecasts</p>
          </div>

          <div className={styles.processSteps}>
            <div className={styles.step}>
              <div className={styles.stepIcon}><FaDatabase /></div>
              <h3>Historical Data Training</h3>
              <p>Our models analyze years of player statistics and roster update patterns to identify meaningful trends</p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepIcon}><FaChartLine /></div>
              <h3>Attribute-Level Predictions</h3>
              <p>
                For each player, we predict changes to individual attributes 
                (7 for batters, 6 for pitchers) with high precision (MSE ≈ 2 per attribute)
              </p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepIcon}><FaLightbulb /></div>
              <h3>Overall Rating Calculation</h3>
              <p>
                We calculate the new overall rating by combining predicted attribute changes,
                maintaining exceptional accuracy (average MSE ≈ 1 for overall rating)
              </p>
            </div>
          </div>

          <div className={styles.noteBox}>
            <FaBrain className={styles.noteIcon} />
            <p>
              While we can't reveal all our proprietary techniques, we're committed to transparency
              about our core methodology. Our models are continuously refined as new data becomes available.
            </p>
          </div>
        </section>

        {/* About Us Section */}
        <section className={styles.teamSection}>
          <div className={styles.sectionHeader}>
            <h2>Meet Our Team</h2>
            <p>Passionate baseball analysts and AI specialists</p>
          </div>

          <div className={styles.teamGrid}>
            <div className={styles.teamMember}>
              <div className={styles.memberIcon}><FaUserGraduate /></div>
              <h3>Alex Chen</h3>
              <p className={styles.memberRole}>AI Specialist</p>
              <p>
                Currently completing a Computer Science degree with AI specialization at MIT.
                Baseball analytics enthusiast with published research on player performance modeling.
              </p>
            </div>

            <div className={styles.teamMember}>
              <div className={styles.memberIcon}><FaUserTie /></div>
              <h3>Jamie Rodriguez</h3>
              <p className={styles.memberRole}>Lead Data Scientist</p>
              <p>
                Computer Science graduate with AI specialization. Currently works as a data analyst
                for the NHL, applying advanced analytics to professional sports performance.
              </p>
            </div>
          </div>

          <div className={styles.missionStatement}>
            <h3>Our Mission</h3>
            <p>
              We founded DiamondInsights to solve the frustration of unpredictable roster updates.
              By combining professional sports analytics experience with cutting-edge machine learning,
              we've created the most accurate prediction system available for MLB The Show investors.
            </p>
          </div>
        </section>

        {/* CTA Section */}
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