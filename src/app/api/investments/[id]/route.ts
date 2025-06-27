// src/app/api/investments/[id]/route.ts
import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { firestore } from '@/lib/firebaseAdmin'
import { headers } from 'next/headers'

/** extract & verify Firebase ID token */
async function getUserId() {
  const h = await headers()
  const authHeader = h.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) throw new Error('Missing or malformed Authorization header')
  const token = match[1]
  const decoded = await admin.auth().verifyIdToken(token)
  return decoded.uid
}

// PATCH /api/investments/:id
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await getUserId()
    // await the params promise:
    const { id } = await context.params

    const body = await req.json()
    // round the avgBuyPrice:
    const newAvg = Math.round(body.avgBuyPrice)

    const invRef = firestore
      .collection('users').doc(uid)
      .collection('investments').doc(id)

    await invRef.update({
      quantity:         body.quantity,
      avgBuyPrice:      newAvg,
      userProjectedOvr: body.userProjectedOvr,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}

// DELETE /api/investments/:id
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await getUserId()
    const { id } = await context.params

    await firestore
      .collection('users').doc(uid)
      .collection('investments').doc(id)
      .delete()

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}
