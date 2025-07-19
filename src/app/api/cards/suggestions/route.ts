// src/app/api/cards/suggestions/route.ts
import { NextResponse } from 'next/server'
import { firestore }     from '@/lib/firebaseAdmin'

export async function GET(request: Request) {
  const q = (new URL(request.url)).searchParams.get('q')?.trim().toLowerCase() || ''
  if (!q) return NextResponse.json([], { status: 200 })

  // helper to build a prefix query
  const makeQ = (field: string) =>
    firestore
      .collection('cards')
      .where('series', '==', 'Live')
      .orderBy(field)
      .startAt(q)
      .endAt(q + '\uf8ff')
      .limit(5)
      .select('name','baked_img')

  // run both in parallel
  const [byFirst, byLast] = await Promise.all([
    makeQ('name_lowercase').get(),
    makeQ('last_name_lowercase').get()
  ])

  // merge & dedupe, preserving original order
  const seen = new Set<string>()
  const out: Array<{id:string, name:string, baked_img?:string}> = []
  for (const snap of [byFirst, byLast]) {
    for (const doc of snap.docs) {
      if (out.length >= 5) break
      if (seen.has(doc.id)) continue
      seen.add(doc.id)
      const d = doc.data()
      out.push({
        id:        doc.id,
        name:      d.name as string,
        baked_img: d.baked_img as string | undefined
      })
    }
  }

  return NextResponse.json(out, {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' }
  })
}
