'use client'

import React, { Suspense } from 'react'
import PredictionsPage from './_PredictionsPage'  // pull your existing page into a child

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <PredictionsPage />
    </Suspense>
  )
}