import { NextResponse } from 'next/server';
import { getEntries,saveEntry } from '../../../lib/db';
import { cleanEntry,validateEntry } from '../../../lib/rules';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!Array.isArray(data.records))
      return NextResponse.json({ error: 'Backup JSON inválido' }, { status: 400 });
    if (data.records.length > 5000)
      return NextResponse.json(
        { error: 'Limite de 5.000 registros por importação' },
        { status: 400 },
      );
    let imported = 0,
      skipped = 0;
    const existing = new Set(getEntries().map((x) => x.id));
    for (const raw of data.records) {
      const r = cleanEntry({
        ...raw,
        status: raw.status || raw.caseStatus,
        id: existing.has(raw.id) ? crypto.randomUUID() : raw.id || crypto.randomUUID(),
      });
      if (validateEntry(r).length) {
        skipped++;
        continue;
      }
      saveEntry(r);
      imported++;
    }
    return NextResponse.json({ imported, skipped });
  } catch {
    return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 });
  }
}
