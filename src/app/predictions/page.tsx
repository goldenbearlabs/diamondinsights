// src/app/predictions/page.tsx
// This is a **Server** component—no 'use client' here.

export const revalidate = 1800  // 30-minute ISR
export const metadata = {
  title: 'Player Predictions'
}

import React, { Suspense } from 'react'
import { FaSpinner } from 'react-icons/fa'
import PredictionsPage, { Card } from './_PredictionsPage'

export default async function Page() {
  // During Vercel builds and in production this env var is auto-set by Vercel
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NODE_ENV === 'production'
      ? 'https://diamondinsights.app'
      : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/cards/live`, {
    next: { revalidate }
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch predictions: ${res.status}`)
  }

  const cards: Card[] = await res.json()

  return (
    <Suspense
      fallback={
        <div className="spinner-container">
          <FaSpinner className="spinner" />
        </div>
      }
    >
      <PredictionsPage initialCards={cards} />
    </Suspense>
  )
}
