import { NextResponse } from 'next/server';
import { db, getEntries, saveEntry } from '../../../lib/db';
import { read } from '../../../lib/database/operations-repository';
import type { Client, Installment } from '../../../lib/collection-types';
import { snapshot } from '../../../lib/database/operations-repository';
import { operationalActivityEntries } from '../../../lib/operational-reports';
import { cleanEntry, validateEntry } from '../../../lib/rules';
export const runtime = 'nodejs';
export async function GET() {
  const operational = operationalActivityEntries(snapshot(db()));
  return NextResponse.json(
    [...getEntries(), ...operational].sort((a, b) => b.date.localeCompare(a.date)),
  );
}
export async function POST(request: Request) {
  try {
    const r = cleanEntry(await request.json());
    if (r.clientId) {
      const client = read<Client>(db(), 'op_clients').find(
        (candidate) => candidate.id === r.clientId,
      );
      if (!client) {
        return NextResponse.json({ error: 'Cliente vinculado não encontrado' }, { status: 400 });
      }
      r.name = client.name;
    }
    if (r.installmentId) {
      if (!r.clientId) {
        return NextResponse.json({ error: 'Selecione o cliente da parcela' }, { status: 400 });
      }
      const installment = read<Installment>(db(), 'op_installments').find(
        (candidate) => candidate.id === r.installmentId && candidate.clientId === r.clientId,
      );
      if (!installment) {
        return NextResponse.json({ error: 'Parcela vinculada não encontrada' }, { status: 400 });
      }
    }
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
