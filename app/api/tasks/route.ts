import { NextResponse } from 'next/server';
import { db, getTasks, saveTask } from '../../../lib/db';
import { isDate } from '../../../lib/rules';
import type { Task } from '../../../lib/types';
export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json(getTasks());
}
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const t: Task = {
      id: String(raw.id || crypto.randomUUID()),
      date: String(raw.date || ''),
      title: String(raw.title || '').trim(),
      status: raw.status || 'Pendente',
      details: String(raw.details || ''),
    };
    if (
      !t.title ||
      !isDate(t.date) ||
      !['Concluída', 'Em andamento', 'Pendente', 'Aguardando alinhamento'].includes(t.status)
    )
      return NextResponse.json(
        { error: 'Revise título, data e status da demanda' },
        { status: 400 },
      );
    saveTask(t);
    return NextResponse.json(t);
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (typeof id !== 'string') return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  db().prepare('DELETE FROM tasks WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
