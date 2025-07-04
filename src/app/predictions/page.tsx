// 1. Force runtime rendering → no build‐time prerender
export const dynamic = 'force-dynamic';
export const runtime = 'edge';
// 2. Keep your ISR window if you still want caching at the edge
export const revalidate = 1800;  // 30 minutes

export const metadata = {
  title: 'Player Predictions',
};

import React, { Suspense } from 'react';
import { FaSpinner } from 'react-icons/fa';
import PredictionsPage, { Card } from './_PredictionsPage';

export default async function Page() {
  // Use a relative URL → this will resolve to your own API route at runtime
  const res = await fetch('/api/cards/live', {
    next: { revalidate },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch predictions: ${res.status}`);
  }

  const cards: Card[] = await res.json();
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
  );
}
