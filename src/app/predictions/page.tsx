// src/app/predictions/page.tsx
// This is now a **server** component—no 'use client' here.

export const revalidate = 1800  // 30-minute ISR
export const metadata = {
  title: 'Player Predictions'
}

import PredictionsPage, { Card } from './_PredictionsPage'
import React, { Suspense } from 'react'
import { FaSpinner } from 'react-icons/fa'

export default async function Page() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/cards/live`, {
    next: { revalidate }
  })
  const cards: Card[] = await res.json()

  return (
    <Suspense fallback={
      <div className="spinner-container">
        <FaSpinner className="spinner" />
      </div>
    }>
      <PredictionsPage initialCards={cards} />
    </Suspense>
  )
}
