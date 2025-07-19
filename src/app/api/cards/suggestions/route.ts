// src/app/api/cards/suggestions/route.ts
import { NextResponse } from 'next/server'
import { firestore }     from '@/lib/firebaseAdmin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  // Firestore doesn’t have a true “startsWith” operator,
  // but you can do range queries on strings:
  const start = q
  const end   = q + '\uf8ff'

  const query = firestore
    .collection('cards')
    .where('series', '==', "Live")
    .orderBy('name_lowercase')    // you’ll need a lowercase‐name field indexed
    .startAt(start)
    .endAt(end)
    .limit(5)
    .select('name', 'baked_img')

  const snap = await query.get()

  const suggestions = snap.docs.map(doc => {
    const data = doc.data()
    return {
      id:          doc.id,
      name:        data.name,
      baked_img:   data.baked_img || null,
    }
  })

  return NextResponse.json(suggestions, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=60'
    }
  })
}
