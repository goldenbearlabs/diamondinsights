import Link from 'next/link'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.footerLogo}>
            <span className={styles.logoPart1}>Diamond</span>
            <span className={styles.logoPart2}>Insights</span>
          </Link>
          <p>AI-powered roster predictions for MLB The Show</p>
        </div>

        <div className={styles.footerLinks}>
          <div className={styles.linkGroup}>
            <h4>Navigation</h4>
            <Link href="/">Home</Link>
            <Link href="/predictions">Predictions</Link>
            <Link href="/investment">Investment Sheet</Link>
          </div>
          <div className={styles.linkGroup}>
            <h4>Account</h4>
            <Link href="/signup">Sign Up</Link>
            <Link href="/login">Login</Link>
            <Link href="/account">My Account</Link>
          </div>
          <div className={styles.linkGroup}>
            <h4>Community</h4>
            <a href="#">Discord</a>
            <a href="#">Twitter</a>
            <a href="#">YouTube</a>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>&copy; 2024 DiamondInsights. All rights reserved.</p>
      </div>
    </footer>
  )
}
