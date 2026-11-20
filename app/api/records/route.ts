import { NextResponse } from 'next/server';
import { db,getEntries,saveEntry } from '../../../lib/db';
import { cleanEntry,validateEntry } from '../../../lib/rules';
export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json(getEntries());
}
export async function POST(request: Request) {
  try {
    const r = cleanEntry(await request.json());
    const errors = validateEntry(r);
    if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    saveEntry(r);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (typeof id !== 'string' || !id)
    return NextResponse.json({ error: 'ID necessário' }, { status: 400 });
  db().prepare('DELETE FROM entries WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
