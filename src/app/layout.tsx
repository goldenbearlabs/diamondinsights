// src/app/layout.tsx
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'DiamondInsights',
  description: 'AI-powered roster predictions for MLB The Show',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main style={{ paddingTop: '4rem' }}>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
