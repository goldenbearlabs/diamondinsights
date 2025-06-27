import { NextResponse } from 'next/server'
import { firestore }    from '@/lib/firebaseAdmin'

export async function POST(
  request: Request,
  context: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await context.params
  const { userId }    = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const ref = firestore.collection('comments').doc(commentId)
  await firestore.runTransaction(async tx => {
    const doc   = await tx.get(ref)
    const likes = (doc.data()?.likes as string[]) || []
    const idx   = likes.indexOf(userId)
    if (idx >= 0) likes.splice(idx, 1)
    else          likes.push(userId)
    tx.update(ref, { likes })
  })

  return NextResponse.json({ success: true })
}
